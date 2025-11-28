/**
 * Expo Config Plugin for ExecuTorch
 * Configures native iOS and Android projects for ExecuTorch integration
 */

import {
  ConfigPlugin,
  withDangerousMod,
  withPlugins,
} from '@expo/config-plugins';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Main ExecuTorch config plugin
 */
const withExecuTorch: ConfigPlugin = (config) => {
  return withPlugins(config, [
    withExecuTorchiOS,
    withExecuTorchAndroid,
  ]);
};

/**
 * iOS configuration
 */
const withExecuTorchiOS: ConfigPlugin = (config) => {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const iosRoot = path.join(projectRoot, 'ios');

      // Create Frameworks directory if it doesn't exist
      const frameworksDir = path.join(iosRoot, 'Frameworks');
      if (!fs.existsSync(frameworksDir)) {
        fs.mkdirSync(frameworksDir, { recursive: true });
      }

      // Add ExecuTorch module to Podfile
      const podfilePath = path.join(iosRoot, 'Podfile');
      if (fs.existsSync(podfilePath)) {
        let podfileContent = fs.readFileSync(podfilePath, 'utf8');

        // Add ExecuTorch pod if not already present
        if (!podfileContent.includes('ExecuTorch')) {
          const podEntry = `
  # ExecuTorch Native Module
  pod 'ExecuTorch', :path => '../modules/executorch/ios'
`;
          // Insert before the 'end' of the target
          podfileContent = podfileContent.replace(
            /(\s+)end(\s+)$/m,
            `$1${podEntry}$1end$2`
          );
          fs.writeFileSync(podfilePath, podfileContent);
        }
      }

      console.log('✅ ExecuTorch iOS configuration complete');
      console.log('⚠️  Remember to:');
      console.log('   1. Place ExecuTorch.framework in ios/Frameworks/');
      console.log('   2. Run: cd ios && pod install');

      return config;
    },
  ]);
};

/**
 * Android configuration
 */
const withExecuTorchAndroid: ConfigPlugin = (config) => {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const androidRoot = path.join(projectRoot, 'android');

      // Add ExecuTorch module to settings.gradle
      const settingsGradlePath = path.join(androidRoot, 'settings.gradle');
      if (fs.existsSync(settingsGradlePath)) {
        let settingsContent = fs.readFileSync(settingsGradlePath, 'utf8');

        if (!settingsContent.includes('executorch')) {
          const moduleEntry = `
include ':executorch'
project(':executorch').projectDir = new File(rootProject.projectDir, '../modules/executorch/android')
`;
          settingsContent += moduleEntry;
          fs.writeFileSync(settingsGradlePath, settingsContent);
        }
      }

      // Add ExecuTorch dependency to app/build.gradle
      const appBuildGradlePath = path.join(androidRoot, 'app', 'build.gradle');
      if (fs.existsSync(appBuildGradlePath)) {
        let buildGradleContent = fs.readFileSync(appBuildGradlePath, 'utf8');

        if (!buildGradleContent.includes('implementation project(\':executorch\')')) {
          // Find dependencies block and add module
          buildGradleContent = buildGradleContent.replace(
            /dependencies\s*{/,
            `dependencies {
    implementation project(':executorch')`
          );
          fs.writeFileSync(appBuildGradlePath, buildGradleContent);
        }
      }

      // Add ExecuTorch package to MainApplication
      const mainApplicationPath = path.join(
        androidRoot,
        'app',
        'src',
        'main',
        'java',
        'com',
        'bachatrainer',
        'MainApplication.java'
      );

      if (fs.existsSync(mainApplicationPath)) {
        let mainAppContent = fs.readFileSync(mainApplicationPath, 'utf8');

        // Add import
        if (!mainAppContent.includes('com.bachatrainer.executorch')) {
          mainAppContent = mainAppContent.replace(
            /import com\.facebook\.react\.ReactApplication;/,
            `import com.facebook.react.ReactApplication;
import com.bachatrainer.executorch.ExecuTorchPackage;`
          );
        }

        // Add package to getPackages()
        if (!mainAppContent.includes('new ExecuTorchPackage()')) {
          mainAppContent = mainAppContent.replace(
            /packages\.add\(new ModuleRegistryAdapter/,
            `packages.add(new ExecuTorchPackage());
        packages.add(new ModuleRegistryAdapter`
          );
        }

        fs.writeFileSync(mainApplicationPath, mainAppContent);
      }

      // Create libs directory for AAR
      const libsDir = path.join(androidRoot, 'app', 'libs');
      if (!fs.existsSync(libsDir)) {
        fs.mkdirSync(libsDir, { recursive: true });
      }

      console.log('✅ ExecuTorch Android configuration complete');
      console.log('⚠️  Remember to:');
      console.log('   1. Place executorch-android.aar in android/app/libs/');
      console.log('   2. Rebuild the Android project');

      return config;
    },
  ]);
};

export default withExecuTorch;
