/**
 * withPodfileTweaks — local Expo config plugin.
 *
 * Injects a post_install hook into the generated ios/Podfile so that pods
 * with known incompatibilities against the current Xcode toolchain build
 * cleanly. Without this, a clean `expo prebuild` + `pod install` +
 * `xcodebuild` fails in places we don't own.
 *
 * Fixes applied (keep this comment list in sync with the hook body):
 *
 *   1) fmt → disable consteval FMT_STRING + force C++17.
 *      RN 0.76 pins `fmt` to an older version whose FMT_STRING() macro
 *      wraps `consteval` constructors in a way Xcode 26's Clang rejects:
 *        "call to consteval function ... is not a constant expression"
 *      Two coordinated knobs defeat this:
 *        a) CLANG_CXX_LANGUAGE_STANDARD = c++17 — keeps the translation
 *           unit off the stricter C++20 consteval path.
 *        b) FMT_USE_CONSTEVAL=0 — fmt's own escape hatch; the macro
 *           falls back to a constexpr constructor the older Clang
 *           accepts. (a) alone is NOT enough on Xcode 26 because
 *           fmt's headers still reach consteval via __cpp_consteval
 *           feature detection.
 *      Delivery matters: setting GCC_PREPROCESSOR_DEFINITIONS from
 *      post_install is unreliable — CocoaPods writes per-target
 *      xcconfig files that can silently drop table-level defines at
 *      compile time (observed in RN 0.76 + CocoaPods 1.16). We instead
 *      pass `-DFMT_USE_CONSTEVAL=0` via OTHER_CPLUSPLUSFLAGS, which is
 *      appended verbatim to the clang++ command line, AND mirror it
 *      into the generated fmt.*.xcconfig files so a re-`pod install`
 *      can't quietly drop it.
 *      Zero runtime impact — fmt ships an identical ABI on both paths
 *      for the parts RN uses.
 *
 *   2) RNCAsyncStorage resource bundles → bump IPHONEOS_DEPLOYMENT_TARGET
 *      to 15.1 (matches our app-wide minimum). The resource bundle
 *      inherits iOS 9.0 which Xcode 26 flags as out-of-range
 *      ("expected >= 2.0 <= 26.4.99"). Harmless as a warning today,
 *      but one Xcode release from becoming an error.
 *
 * Why a local plugin instead of expo-build-properties: the latter doesn't
 * expose a Podfile post_install hook. This plugin is the documented escape
 * hatch (`withDangerousMod`), scoped narrowly so it's easy to remove once
 * upstream RN/AsyncStorage ships a fix and we upgrade past it.
 */

const { withDangerousMod } = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

// Bump the suffix whenever TWEAK_BLOCK changes so the idempotency guard
// below re-patches a previously-patched Podfile. Without this, stale
// prebuilds from an earlier plugin version would never get the new fix.
const SENTINEL = "# LUMO_PODFILE_TWEAKS_v3";

const TWEAK_BLOCK = `
    ${SENTINEL}
    # See plugins/withPodfileTweaks.js for rationale.
    installer.pods_project.targets.each do |target|
      # fmt: dodge Xcode 26 consteval strictness.
      # GCC_PREPROCESSOR_DEFINITIONS from post_install gets merged into a
      # table that the generated per-target xcconfig can clobber. Passing
      # -D via OTHER_CPLUSPLUSFLAGS is resistant to that — it's appended
      # to the compiler invocation verbatim. We also belt-and-suspender
      # patch the xcconfig files directly so nothing upstream can drop it.
      if target.name == 'fmt'
        target.build_configurations.each do |config|
          config.build_settings['CLANG_CXX_LANGUAGE_STANDARD'] = 'c++17'

          cpp_flags = config.build_settings['OTHER_CPLUSPLUSFLAGS'] || ['$(inherited)']
          cpp_flags = [cpp_flags] unless cpp_flags.is_a?(Array)
          cpp_flags << '-DFMT_USE_CONSTEVAL=0' unless cpp_flags.include?('-DFMT_USE_CONSTEVAL=0')
          config.build_settings['OTHER_CPLUSPLUSFLAGS'] = cpp_flags

          # Also append to the generated xcconfig so the flag survives
          # any later regeneration and is visible on the final compile line.
          xcconfig_ref = config.base_configuration_reference
          next unless xcconfig_ref
          xcconfig_path = xcconfig_ref.real_path.to_s
          if File.exist?(xcconfig_path)
            contents = File.read(xcconfig_path)
            unless contents.include?('FMT_USE_CONSTEVAL=0')
              File.open(xcconfig_path, 'a') do |f|
                f.puts ''
                f.puts '// Lumo: Xcode 26 fmt consteval workaround.'
                f.puts 'OTHER_CPLUSPLUSFLAGS = $(inherited) -DFMT_USE_CONSTEVAL=0'
                f.puts 'CLANG_CXX_LANGUAGE_STANDARD = c++17'
              end
            end
          end
        end
      end

      # RNCAsyncStorage resource bundles inherit iOS 9.0; bump to 15.1.
      if target.name.start_with?('RNCAsyncStorage')
        target.build_configurations.each do |config|
          config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '15.1'
        end
      end
    end
`;

const withPodfileTweaks = (config) => {
  return withDangerousMod(config, [
    "ios",
    async (cfg) => {
      const podfilePath = path.join(
        cfg.modRequest.platformProjectRoot,
        "Podfile"
      );

      if (!fs.existsSync(podfilePath)) {
        // Expo hasn't written the Podfile yet — unusual, bail quietly.
        return cfg;
      }

      let contents = fs.readFileSync(podfilePath, "utf8");

      // Idempotency: skip if we've already patched this Podfile.
      if (contents.includes(SENTINEL)) {
        return cfg;
      }

      // The generated Podfile has exactly one top-level post_install block.
      // Inject our tweaks at the top of that block so they run before any
      // user or Expo-internal post_install logic.
      const hookRegex = /post_install do \|installer\|\n/;
      if (!hookRegex.test(contents)) {
        // If RN ever changes the generated Podfile shape, fail loud rather
        // than silently drop the fix. A red prebuild is preferable to a
        // green one that produces an un-buildable project.
        throw new Error(
          "[withPodfileTweaks] Expected `post_install do |installer|` block " +
            "in generated Podfile; none found. Has the RN template changed?"
        );
      }

      contents = contents.replace(hookRegex, `post_install do |installer|\n${TWEAK_BLOCK}`);
      fs.writeFileSync(podfilePath, contents);

      return cfg;
    },
  ]);
};

module.exports = withPodfileTweaks;
