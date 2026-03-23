/**
 * iOS Project Generator - Creates complete, buildable Xcode projects
 */

import fs from 'fs/promises';
import path from 'path';

// Generate unique IDs for pbxproj
const uuid = (prefix = 'A') => {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let result = prefix;
  for (let i = 0; i < 11; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result + '0'.repeat(24 - result.length);
};

// Default screen templates
const SCREEN_TEMPLATES = {
  Home: {
    viewModel: `import SwiftUI
import Observation

@Observable
class HomeViewModel {
    var isLoading = false
    var items: [String] = []
    
    func loadData() async {
        isLoading = true
        try? await Task.sleep(for: .seconds(1))
        items = ["Item 1", "Item 2", "Item 3"]
        isLoading = false
    }
}`,
    view: `import SwiftUI

struct HomeView: View {
    @State private var viewModel = HomeViewModel()
    
    var body: some View {
        NavigationStack {
            List {
                if viewModel.isLoading {
                    ProgressView()
                        .frame(maxWidth: .infinity)
                } else {
                    ForEach(viewModel.items, id: \\.self) { item in
                        Text(item)
                    }
                }
            }
            .navigationTitle("Home")
            .task {
                await viewModel.loadData()
            }
        }
    }
}

#Preview {
    HomeView()
        .preferredColorScheme(.dark)
}`
  },
  Settings: {
    viewModel: `import SwiftUI
import Observation

@Observable
class SettingsViewModel {
    var notificationsEnabled = true
    var darkModeEnabled = true
    var soundEnabled = true
}`,
    view: `import SwiftUI

struct SettingsView: View {
    @State private var viewModel = SettingsViewModel()
    
    var body: some View {
        NavigationStack {
            List {
                Section("Preferences") {
                    Toggle("Notifications", isOn: $viewModel.notificationsEnabled)
                    Toggle("Dark Mode", isOn: $viewModel.darkModeEnabled)
                    Toggle("Sounds", isOn: $viewModel.soundEnabled)
                }
                
                Section {
                    Button("Rate App") {}
                    Button("Contact Support") {}
                }
                
                Section {
                    Button("Log Out", role: .destructive) {}
                }
            }
            .navigationTitle("Settings")
        }
    }
}

#Preview {
    SettingsView()
        .preferredColorScheme(.dark)
}`
  }
};

/**
 * Generate a complete, buildable iOS project
 */
export async function generateFullProject(projectPath, options) {
  const {
    appName,
    bundleId,
    screens = [{ name: 'Home', description: 'Main screen' }, { name: 'Settings', description: 'Settings' }],
    features = []
  } = options;

  const className = appName.replace(/[^a-zA-Z0-9]/g, '');
  const bundle = bundleId || `com.app.${appName.toLowerCase().replace(/[^a-z0-9]/g, '')}`;

  // Create directory structure (flat structure for App files)
  const dirs = [
    `${className}`,
    `${className}/Views`,
    `${className}/ViewModels`,
    `${className}/Models`,
    `${className}/Services`,
    `${className}/Resources/Assets.xcassets/AppIcon.appiconset`,
    `${className}/Resources/Assets.xcassets/AccentColor.colorset`,
    `${className}Tests`,
    `${className}.xcodeproj`
  ];

  for (const dir of dirs) {
    await fs.mkdir(path.join(projectPath, dir), { recursive: true });
  }

  const files = [];

  // === APP ENTRY POINT ===
  const appSwift = `import SwiftUI
${features.includes('firebase') ? 'import Firebase' : ''}
${features.includes('revenuecat') ? 'import RevenueCat' : ''}

@main
struct ${className}App: App {
    init() {
        ${features.includes('firebase') ? 'FirebaseApp.configure()' : ''}
        ${features.includes('revenuecat') ? 'Purchases.configure(withAPIKey: "your_api_key")' : ''}
    }
    
    var body: some Scene {
        WindowGroup {
            ContentView()
                .preferredColorScheme(.dark)
        }
    }
}
`;
  await fs.writeFile(path.join(projectPath, className, `${className}App.swift`), appSwift);
  files.push(`${className}/${className}App.swift`);

  // === CONTENT VIEW ===
  const screenViews = screens.map(s => {
    const viewName = s.name.replace(/\s/g, '');
    return `            ${viewName}View()
                .tabItem {
                    Label("${s.name}", systemImage: "${getSystemImage(s.name)}")
                }
                .tag(${screens.indexOf(s)})`;
  }).join('\n');

  const contentView = `import SwiftUI

struct ContentView: View {
    @State private var selectedTab = 0
    
    var body: some View {
        TabView(selection: $selectedTab) {
${screenViews}
        }
        .tint(.blue)
    }
}

#Preview {
    ContentView()
        .preferredColorScheme(.dark)
}
`;
  await fs.writeFile(path.join(projectPath, className, 'ContentView.swift'), contentView);
  files.push(`${className}/ContentView.swift`);

  // === VIEWS & VIEWMODELS ===
  for (const screen of screens) {
    const viewName = screen.name.replace(/\s/g, '');
    const template = SCREEN_TEMPLATES[viewName] || generateScreenTemplate(viewName, screen.description);
    
    await fs.writeFile(
      path.join(projectPath, className, 'ViewModels', `${viewName}ViewModel.swift`),
      template.viewModel
    );
    files.push(`${className}/ViewModels/${viewName}ViewModel.swift`);

    await fs.writeFile(
      path.join(projectPath, className, 'Views', `${viewName}View.swift`),
      template.view
    );
    files.push(`${className}/Views/${viewName}View.swift`);
  }

  // === COLORS ===
  const colorsSwift = `import SwiftUI

extension ShapeStyle where Self == Color {
    static var background: Color {
        Color(red: 10/255, green: 10/255, blue: 10/255)
    }
    
    static var cardBackground: Color {
        Color.white.opacity(0.05)
    }
    
    static var cardBorder: Color {
        Color.white.opacity(0.1)
    }
}
`;
  await fs.writeFile(path.join(projectPath, className, 'Resources', 'Colors.swift'), colorsSwift);
  files.push(`${className}/Resources/Colors.swift`);

  // === ASSETS ===
  await fs.writeFile(
    path.join(projectPath, className, 'Resources/Assets.xcassets', 'Contents.json'),
    JSON.stringify({ info: { author: 'xcode', version: 1 } }, null, 2)
  );
  
  await fs.writeFile(
    path.join(projectPath, className, 'Resources/Assets.xcassets/AccentColor.colorset', 'Contents.json'),
    JSON.stringify({
      colors: [{
        color: { 'color-space': 'srgb', components: { alpha: '1.000', blue: '0.925', green: '0.349', red: '0.075' } },
        idiom: 'universal'
      }],
      info: { author: 'xcode', version: 1 }
    }, null, 2)
  );

  await fs.writeFile(
    path.join(projectPath, className, 'Resources/Assets.xcassets/AppIcon.appiconset', 'Contents.json'),
    JSON.stringify({
      images: [{ idiom: 'universal', platform: 'ios', size: '1024x1024' }],
      info: { author: 'xcode', version: 1 }
    }, null, 2)
  );
  files.push(`${className}/Resources/Assets.xcassets`);

  // === SERVICES ===
  if (features.includes('supabase')) {
    const supabase = `import Foundation
import Supabase

class SupabaseManager {
    static let shared = SupabaseManager()
    
    let client = SupabaseClient(
        supabaseURL: URL(string: "YOUR_SUPABASE_URL")!,
        supabaseKey: "YOUR_SUPABASE_KEY"
    )
    
    private init() {}
}
`;
    await fs.writeFile(path.join(projectPath, className, 'Services', 'SupabaseManager.swift'), supabase);
    files.push(`${className}/Services/SupabaseManager.swift`);
  }

  // === TESTS ===
  const testFile = `import XCTest
@testable import ${className}

final class ${className}Tests: XCTestCase {
    func testExample() throws {
        XCTAssertTrue(true)
    }
}
`;
  await fs.writeFile(path.join(projectPath, `${className}Tests`, `${className}Tests.swift`), testFile);
  files.push(`${className}Tests/${className}Tests.swift`);

  // === GENERATE PBXPROJ ===
  const pbxproj = generateCompletePbxproj(className, bundle, files, screens);
  await fs.writeFile(path.join(projectPath, `${className}.xcodeproj`, 'project.pbxproj'), pbxproj);

  return {
    success: true,
    xcodeproj: `${className}.xcodeproj`,
    files,
    screens: screens.map(s => s.name)
  };
}

function generateScreenTemplate(viewName, description) {
  return {
    viewModel: `import SwiftUI
import Observation

@Observable
class ${viewName}ViewModel {
    var isLoading = false
    
    func load() async {
        isLoading = true
        try? await Task.sleep(for: .seconds(0.5))
        isLoading = false
    }
}`,
    view: `import SwiftUI

struct ${viewName}View: View {
    @State private var viewModel = ${viewName}ViewModel()
    
    var body: some View {
        NavigationStack {
            VStack {
                if viewModel.isLoading {
                    ProgressView()
                } else {
                    Text("${viewName}")
                        .font(.largeTitle)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Color.background)
            .navigationTitle("${viewName}")
            .task {
                await viewModel.load()
            }
        }
    }
}

#Preview {
    ${viewName}View()
        .preferredColorScheme(.dark)
}`
  };
}

function getSystemImage(name) {
  const lower = name.toLowerCase();
  if (lower.includes('home')) return 'house.fill';
  if (lower.includes('setting')) return 'gearshape.fill';
  if (lower.includes('profile')) return 'person.fill';
  if (lower.includes('search')) return 'magnifyingglass';
  if (lower.includes('history')) return 'clock.fill';
  if (lower.includes('stat')) return 'chart.bar.fill';
  if (lower.includes('wallet')) return 'wallet.bifold.fill';
  if (lower.includes('chat')) return 'bubble.left.fill';
  if (lower.includes('list')) return 'list.bullet';
  return 'square.fill';
}

function generateCompletePbxproj(className, bundleId, sourceFiles, screens) {
  // Generate UUIDs for all elements
  const ids = {
    project: uuid('PRJ'),
    mainGroup: uuid('GRP'),
    productsGroup: uuid('PRD'),
    appTarget: uuid('TGT'),
    testTarget: uuid('TST'),
    appProduct: uuid('APP'),
    testProduct: uuid('XCT'),
    sourcesPhase: uuid('SRC'),
    resourcesPhase: uuid('RES'),
    frameworksPhase: uuid('FRM'),
    testSourcesPhase: uuid('TSR'),
    testFrameworksPhase: uuid('TFR'),
    testResourcesPhase: uuid('TRS'),
    projectConfigList: uuid('PCL'),
    appConfigList: uuid('ACL'),
    testConfigList: uuid('TCL'),
    debugConfig: uuid('DBG'),
    releaseConfig: uuid('REL'),
    appDebugConfig: uuid('ADB'),
    appReleaseConfig: uuid('ARL'),
    testDebugConfig: uuid('TDB'),
    testReleaseConfig: uuid('TRL'),
    appGroup: uuid('AGP'),
    viewsGroup: uuid('VGP'),
    viewModelsGroup: uuid('VMG'),
    modelsGroup: uuid('MDG'),
    servicesGroup: uuid('SVG'),
    resourcesGroup: uuid('RSG'),
    testsGroup: uuid('TGP'),
    dependency: uuid('DEP'),
    containerProxy: uuid('CIP')
  };

  // Generate file references and build files (separated by target)
  const fileRefs = [];
  const appSourceBuildIds = [];
  const appResourceBuildIds = [];
  const testSourceBuildIds = [];
  const buildFileLines = [];
  
  const appGroupChildren = [];
  const viewsGroupChildren = [];
  const viewModelsGroupChildren = [];
  const servicesGroupChildren = [];
  const resourcesGroupChildren = [];
  const testsGroupChildren = [];

  for (const file of sourceFiles) {
    const fileId = uuid('FIL');
    const buildId = uuid('BLD');
    const fileName = path.basename(file);
    const fileType = file.endsWith('.xcassets') ? 'folder.assetcatalog' : 'sourcecode.swift';
    
    fileRefs.push(`\t\t${fileId} /* ${fileName} */ = {isa = PBXFileReference; lastKnownFileType = ${fileType}; path = ${fileName}; sourceTree = "<group>"; };`);
    
    if (file.includes('Tests/')) {
      // Test files go to test target only
      buildFileLines.push(`\t\t${buildId} /* ${fileName} in Sources */ = {isa = PBXBuildFile; fileRef = ${fileId} /* ${fileName} */; };`);
      testSourceBuildIds.push(buildId);
      testsGroupChildren.push(fileId);
    } else if (file.endsWith('.xcassets')) {
      // Assets go to resources phase
      buildFileLines.push(`\t\t${buildId} /* ${fileName} in Resources */ = {isa = PBXBuildFile; fileRef = ${fileId} /* ${fileName} */; };`);
      appResourceBuildIds.push(buildId);
      resourcesGroupChildren.push(fileId);
    } else {
      // Swift source files go to sources phase
      buildFileLines.push(`\t\t${buildId} /* ${fileName} in Sources */ = {isa = PBXBuildFile; fileRef = ${fileId} /* ${fileName} */; };`);
      appSourceBuildIds.push(buildId);
      
      // Group assignment
      if (file.includes('/Views/')) {
        viewsGroupChildren.push(fileId);
      } else if (file.includes('/ViewModels/')) {
        viewModelsGroupChildren.push(fileId);
      } else if (file.includes('/Services/')) {
        servicesGroupChildren.push(fileId);
      } else if (file.includes('/Resources/')) {
        resourcesGroupChildren.push(fileId);
      } else {
        appGroupChildren.push(fileId);
      }
    }
  }

  // Add product references
  fileRefs.push(`\t\t${ids.appProduct} /* ${className}.app */ = {isa = PBXFileReference; explicitFileType = wrapper.application; includeInIndex = 0; path = ${className}.app; sourceTree = BUILT_PRODUCTS_DIR; };`);
  fileRefs.push(`\t\t${ids.testProduct} /* ${className}Tests.xctest */ = {isa = PBXFileReference; explicitFileType = wrapper.cfbundle; includeInIndex = 0; path = ${className}Tests.xctest; sourceTree = BUILT_PRODUCTS_DIR; };`);

  // Format build ID lists for pbxproj
  const appSourceFiles = appSourceBuildIds.join(',\n\t\t\t\t');
  const appResourceFiles = appResourceBuildIds.join(',\n\t\t\t\t');
  const testSourceFiles = testSourceBuildIds.join(',\n\t\t\t\t');

  return `// !$*UTF8*$!
{
	archiveVersion = 1;
	classes = {
	};
	objectVersion = 56;
	objects = {

/* Begin PBXBuildFile section */
${buildFileLines.join('\n')}
/* End PBXBuildFile section */

/* Begin PBXContainerItemProxy section */
		${ids.containerProxy} /* PBXContainerItemProxy */ = {
			isa = PBXContainerItemProxy;
			containerPortal = ${ids.project} /* Project object */;
			proxyType = 1;
			remoteGlobalIDString = ${ids.appTarget};
			remoteInfo = ${className};
		};
/* End PBXContainerItemProxy section */

/* Begin PBXFileReference section */
${fileRefs.join('\n')}
/* End PBXFileReference section */

/* Begin PBXFrameworksBuildPhase section */
		${ids.frameworksPhase} /* Frameworks */ = {
			isa = PBXFrameworksBuildPhase;
			buildActionMask = 2147483647;
			files = (
			);
			runOnlyForDeploymentPostprocessing = 0;
		};
		${ids.testFrameworksPhase} /* Frameworks */ = {
			isa = PBXFrameworksBuildPhase;
			buildActionMask = 2147483647;
			files = (
			);
			runOnlyForDeploymentPostprocessing = 0;
		};
/* End PBXFrameworksBuildPhase section */

/* Begin PBXGroup section */
		${ids.mainGroup} = {
			isa = PBXGroup;
			children = (
				${ids.appGroup} /* ${className} */,
				${ids.testsGroup} /* ${className}Tests */,
				${ids.productsGroup} /* Products */,
			);
			sourceTree = "<group>";
		};
		${ids.productsGroup} /* Products */ = {
			isa = PBXGroup;
			children = (
				${ids.appProduct} /* ${className}.app */,
				${ids.testProduct} /* ${className}Tests.xctest */,
			);
			name = Products;
			sourceTree = "<group>";
		};
		${ids.appGroup} /* ${className} */ = {
			isa = PBXGroup;
			children = (
				${appGroupChildren.join(',\n\t\t\t\t')},
				${ids.viewsGroup} /* Views */,
				${ids.viewModelsGroup} /* ViewModels */,
				${ids.servicesGroup} /* Services */,
				${ids.resourcesGroup} /* Resources */,
			);
			path = ${className};
			sourceTree = "<group>";
		};
		${ids.viewsGroup} /* Views */ = {
			isa = PBXGroup;
			children = (
				${viewsGroupChildren.join(',\n\t\t\t\t')}
			);
			path = Views;
			sourceTree = "<group>";
		};
		${ids.viewModelsGroup} /* ViewModels */ = {
			isa = PBXGroup;
			children = (
				${viewModelsGroupChildren.join(',\n\t\t\t\t')}
			);
			path = ViewModels;
			sourceTree = "<group>";
		};
		${ids.servicesGroup} /* Services */ = {
			isa = PBXGroup;
			children = (
				${servicesGroupChildren.join(',\n\t\t\t\t')}
			);
			path = Services;
			sourceTree = "<group>";
		};
		${ids.resourcesGroup} /* Resources */ = {
			isa = PBXGroup;
			children = (
				${resourcesGroupChildren.join(',\n\t\t\t\t')}
			);
			path = Resources;
			sourceTree = "<group>";
		};
		${ids.testsGroup} /* ${className}Tests */ = {
			isa = PBXGroup;
			children = (
				${testsGroupChildren.join(',\n\t\t\t\t')}
			);
			path = ${className}Tests;
			sourceTree = "<group>";
		};
/* End PBXGroup section */

/* Begin PBXNativeTarget section */
		${ids.appTarget} /* ${className} */ = {
			isa = PBXNativeTarget;
			buildConfigurationList = ${ids.appConfigList} /* Build configuration list for PBXNativeTarget "${className}" */;
			buildPhases = (
				${ids.sourcesPhase} /* Sources */,
				${ids.frameworksPhase} /* Frameworks */,
				${ids.resourcesPhase} /* Resources */,
			);
			buildRules = (
			);
			dependencies = (
			);
			name = ${className};
			productName = ${className};
			productReference = ${ids.appProduct} /* ${className}.app */;
			productType = "com.apple.product-type.application";
		};
		${ids.testTarget} /* ${className}Tests */ = {
			isa = PBXNativeTarget;
			buildConfigurationList = ${ids.testConfigList} /* Build configuration list for PBXNativeTarget "${className}Tests" */;
			buildPhases = (
				${ids.testSourcesPhase} /* Sources */,
				${ids.testFrameworksPhase} /* Frameworks */,
				${ids.testResourcesPhase} /* Resources */,
			);
			buildRules = (
			);
			dependencies = (
				${ids.dependency} /* PBXTargetDependency */,
			);
			name = ${className}Tests;
			productName = ${className}Tests;
			productReference = ${ids.testProduct} /* ${className}Tests.xctest */;
			productType = "com.apple.product-type.bundle.unit-test";
		};
/* End PBXNativeTarget section */

/* Begin PBXProject section */
		${ids.project} /* Project object */ = {
			isa = PBXProject;
			attributes = {
				BuildIndependentTargetsInParallel = 1;
				LastSwiftUpdateCheck = 1540;
				LastUpgradeCheck = 1540;
				TargetAttributes = {
					${ids.appTarget} = {
						CreatedOnToolsVersion = 15.4;
					};
					${ids.testTarget} = {
						CreatedOnToolsVersion = 15.4;
						TestTargetID = ${ids.appTarget};
					};
				};
			};
			buildConfigurationList = ${ids.projectConfigList} /* Build configuration list for PBXProject "${className}" */;
			compatibilityVersion = "Xcode 14.0";
			developmentRegion = en;
			hasScannedForEncodings = 0;
			knownRegions = (
				en,
				Base,
			);
			mainGroup = ${ids.mainGroup};
			productRefGroup = ${ids.productsGroup} /* Products */;
			projectDirPath = "";
			projectRoot = "";
			targets = (
				${ids.appTarget} /* ${className} */,
				${ids.testTarget} /* ${className}Tests */,
			);
		};
/* End PBXProject section */

/* Begin PBXResourcesBuildPhase section */
		${ids.resourcesPhase} /* Resources */ = {
			isa = PBXResourcesBuildPhase;
			buildActionMask = 2147483647;
			files = (
				${appResourceFiles}
			);
			runOnlyForDeploymentPostprocessing = 0;
		};
		${ids.testResourcesPhase} /* Resources */ = {
			isa = PBXResourcesBuildPhase;
			buildActionMask = 2147483647;
			files = (
			);
			runOnlyForDeploymentPostprocessing = 0;
		};
/* End PBXResourcesBuildPhase section */

/* Begin PBXSourcesBuildPhase section */
		${ids.sourcesPhase} /* Sources */ = {
			isa = PBXSourcesBuildPhase;
			buildActionMask = 2147483647;
			files = (
				${appSourceFiles}
			);
			runOnlyForDeploymentPostprocessing = 0;
		};
		${ids.testSourcesPhase} /* Sources */ = {
			isa = PBXSourcesBuildPhase;
			buildActionMask = 2147483647;
			files = (
				${testSourceFiles}
			);
			runOnlyForDeploymentPostprocessing = 0;
		};
/* End PBXSourcesBuildPhase section */

/* Begin PBXTargetDependency section */
		${ids.dependency} /* PBXTargetDependency */ = {
			isa = PBXTargetDependency;
			target = ${ids.appTarget} /* ${className} */;
			targetProxy = ${ids.containerProxy} /* PBXContainerItemProxy */;
		};
/* End PBXTargetDependency section */

/* Begin XCBuildConfiguration section */
		${ids.debugConfig} /* Debug */ = {
			isa = XCBuildConfiguration;
			buildSettings = {
				ALWAYS_SEARCH_USER_PATHS = NO;
				ASSETCATALOG_COMPILER_GENERATE_SWIFT_ASSET_SYMBOL_EXTENSIONS = YES;
				CLANG_ANALYZER_NONNULL = YES;
				CLANG_ANALYZER_NUMBER_OBJECT_CONVERSION = YES_AGGRESSIVE;
				CLANG_CXX_LANGUAGE_STANDARD = "gnu++20";
				CLANG_ENABLE_MODULES = YES;
				CLANG_ENABLE_OBJC_ARC = YES;
				CLANG_ENABLE_OBJC_WEAK = YES;
				CLANG_WARN_BLOCK_CAPTURE_AUTORELEASING = YES;
				CLANG_WARN_BOOL_CONVERSION = YES;
				CLANG_WARN_COMMA = YES;
				CLANG_WARN_CONSTANT_CONVERSION = YES;
				CLANG_WARN_DEPRECATED_OBJC_IMPLEMENTATIONS = YES;
				CLANG_WARN_DIRECT_OBJC_ISA_USAGE = YES_ERROR;
				CLANG_WARN_DOCUMENTATION_COMMENTS = YES;
				CLANG_WARN_EMPTY_BODY = YES;
				CLANG_WARN_ENUM_CONVERSION = YES;
				CLANG_WARN_INFINITE_RECURSION = YES;
				CLANG_WARN_INT_CONVERSION = YES;
				CLANG_WARN_NON_LITERAL_NULL_CONVERSION = YES;
				CLANG_WARN_OBJC_IMPLICIT_RETAIN_SELF = YES;
				CLANG_WARN_OBJC_LITERAL_CONVERSION = YES;
				CLANG_WARN_OBJC_ROOT_CLASS = YES_ERROR;
				CLANG_WARN_QUOTED_INCLUDE_IN_FRAMEWORK_HEADER = YES;
				CLANG_WARN_RANGE_LOOP_ANALYSIS = YES;
				CLANG_WARN_STRICT_PROTOTYPES = YES;
				CLANG_WARN_SUSPICIOUS_MOVE = YES;
				CLANG_WARN_UNGUARDED_AVAILABILITY = YES_AGGRESSIVE;
				CLANG_WARN_UNREACHABLE_CODE = YES;
				CLANG_WARN__DUPLICATE_METHOD_MATCH = YES;
				COPY_PHASE_STRIP = NO;
				DEBUG_INFORMATION_FORMAT = dwarf;
				ENABLE_STRICT_OBJC_MSGSEND = YES;
				ENABLE_TESTABILITY = YES;
				ENABLE_USER_SCRIPT_SANDBOXING = YES;
				GCC_C_LANGUAGE_STANDARD = gnu17;
				GCC_DYNAMIC_NO_PIC = NO;
				GCC_NO_COMMON_BLOCKS = YES;
				GCC_OPTIMIZATION_LEVEL = 0;
				GCC_PREPROCESSOR_DEFINITIONS = (
					"DEBUG=1",
					"$(inherited)",
				);
				GCC_WARN_64_TO_32_BIT_CONVERSION = YES;
				GCC_WARN_ABOUT_RETURN_TYPE = YES_ERROR;
				GCC_WARN_UNDECLARED_SELECTOR = YES;
				GCC_WARN_UNINITIALIZED_AUTOS = YES_AGGRESSIVE;
				GCC_WARN_UNUSED_FUNCTION = YES;
				GCC_WARN_UNUSED_VARIABLE = YES;
				IPHONEOS_DEPLOYMENT_TARGET = 17.0;
				LOCALIZATION_PREFERS_STRING_CATALOGS = YES;
				MTL_ENABLE_DEBUG_INFO = INCLUDE_SOURCE;
				MTL_FAST_MATH = YES;
				ONLY_ACTIVE_ARCH = YES;
				SDKROOT = iphoneos;
				SWIFT_ACTIVE_COMPILATION_CONDITIONS = "DEBUG $(inherited)";
				SWIFT_OPTIMIZATION_LEVEL = "-Onone";
			};
			name = Debug;
		};
		${ids.releaseConfig} /* Release */ = {
			isa = XCBuildConfiguration;
			buildSettings = {
				ALWAYS_SEARCH_USER_PATHS = NO;
				ASSETCATALOG_COMPILER_GENERATE_SWIFT_ASSET_SYMBOL_EXTENSIONS = YES;
				CLANG_ANALYZER_NONNULL = YES;
				CLANG_ANALYZER_NUMBER_OBJECT_CONVERSION = YES_AGGRESSIVE;
				CLANG_CXX_LANGUAGE_STANDARD = "gnu++20";
				CLANG_ENABLE_MODULES = YES;
				CLANG_ENABLE_OBJC_ARC = YES;
				CLANG_ENABLE_OBJC_WEAK = YES;
				CLANG_WARN_BLOCK_CAPTURE_AUTORELEASING = YES;
				CLANG_WARN_BOOL_CONVERSION = YES;
				CLANG_WARN_COMMA = YES;
				CLANG_WARN_CONSTANT_CONVERSION = YES;
				CLANG_WARN_DEPRECATED_OBJC_IMPLEMENTATIONS = YES;
				CLANG_WARN_DIRECT_OBJC_ISA_USAGE = YES_ERROR;
				CLANG_WARN_DOCUMENTATION_COMMENTS = YES;
				CLANG_WARN_EMPTY_BODY = YES;
				CLANG_WARN_ENUM_CONVERSION = YES;
				CLANG_WARN_INFINITE_RECURSION = YES;
				CLANG_WARN_INT_CONVERSION = YES;
				CLANG_WARN_NON_LITERAL_NULL_CONVERSION = YES;
				CLANG_WARN_OBJC_IMPLICIT_RETAIN_SELF = YES;
				CLANG_WARN_OBJC_LITERAL_CONVERSION = YES;
				CLANG_WARN_OBJC_ROOT_CLASS = YES_ERROR;
				CLANG_WARN_QUOTED_INCLUDE_IN_FRAMEWORK_HEADER = YES;
				CLANG_WARN_RANGE_LOOP_ANALYSIS = YES;
				CLANG_WARN_STRICT_PROTOTYPES = YES;
				CLANG_WARN_SUSPICIOUS_MOVE = YES;
				CLANG_WARN_UNGUARDED_AVAILABILITY = YES_AGGRESSIVE;
				CLANG_WARN_UNREACHABLE_CODE = YES;
				CLANG_WARN__DUPLICATE_METHOD_MATCH = YES;
				COPY_PHASE_STRIP = NO;
				DEBUG_INFORMATION_FORMAT = "dwarf-with-dsym";
				ENABLE_NS_ASSERTIONS = NO;
				ENABLE_STRICT_OBJC_MSGSEND = YES;
				ENABLE_USER_SCRIPT_SANDBOXING = YES;
				GCC_C_LANGUAGE_STANDARD = gnu17;
				GCC_NO_COMMON_BLOCKS = YES;
				GCC_WARN_64_TO_32_BIT_CONVERSION = YES;
				GCC_WARN_ABOUT_RETURN_TYPE = YES_ERROR;
				GCC_WARN_UNDECLARED_SELECTOR = YES;
				GCC_WARN_UNINITIALIZED_AUTOS = YES_AGGRESSIVE;
				GCC_WARN_UNUSED_FUNCTION = YES;
				GCC_WARN_UNUSED_VARIABLE = YES;
				IPHONEOS_DEPLOYMENT_TARGET = 17.0;
				LOCALIZATION_PREFERS_STRING_CATALOGS = YES;
				MTL_ENABLE_DEBUG_INFO = NO;
				MTL_FAST_MATH = YES;
				SDKROOT = iphoneos;
				SWIFT_COMPILATION_MODE = wholemodule;
				VALIDATE_PRODUCT = YES;
			};
			name = Release;
		};
		${ids.appDebugConfig} /* Debug */ = {
			isa = XCBuildConfiguration;
			buildSettings = {
				ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon;
				ASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME = AccentColor;
				CODE_SIGN_STYLE = Automatic;
				CURRENT_PROJECT_VERSION = 1;
				DEVELOPMENT_TEAM = "";
				ENABLE_PREVIEWS = YES;
				GENERATE_INFOPLIST_FILE = YES;
				INFOPLIST_KEY_CFBundleDisplayName = ${className};
				INFOPLIST_KEY_UIApplicationSceneManifest_Generation = YES;
				INFOPLIST_KEY_UIApplicationSupportsIndirectInputEvents = YES;
				INFOPLIST_KEY_UILaunchScreen_Generation = YES;
				INFOPLIST_KEY_UISupportedInterfaceOrientations_iPad = "UIInterfaceOrientationPortrait UIInterfaceOrientationPortraitUpsideDown UIInterfaceOrientationLandscapeLeft UIInterfaceOrientationLandscapeRight";
				INFOPLIST_KEY_UISupportedInterfaceOrientations_iPhone = "UIInterfaceOrientationPortrait UIInterfaceOrientationLandscapeLeft UIInterfaceOrientationLandscapeRight";
				LD_RUNPATH_SEARCH_PATHS = (
					"$(inherited)",
					"@executable_path/Frameworks",
				);
				MARKETING_VERSION = 1.0;
				PRODUCT_BUNDLE_IDENTIFIER = "${bundleId}";
				PRODUCT_NAME = "$(TARGET_NAME)";
				SWIFT_EMIT_LOC_STRINGS = YES;
				SWIFT_VERSION = 5.0;
				TARGETED_DEVICE_FAMILY = "1,2";
			};
			name = Debug;
		};
		${ids.appReleaseConfig} /* Release */ = {
			isa = XCBuildConfiguration;
			buildSettings = {
				ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon;
				ASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME = AccentColor;
				CODE_SIGN_STYLE = Automatic;
				CURRENT_PROJECT_VERSION = 1;
				DEVELOPMENT_TEAM = "";
				ENABLE_PREVIEWS = YES;
				GENERATE_INFOPLIST_FILE = YES;
				INFOPLIST_KEY_CFBundleDisplayName = ${className};
				INFOPLIST_KEY_UIApplicationSceneManifest_Generation = YES;
				INFOPLIST_KEY_UIApplicationSupportsIndirectInputEvents = YES;
				INFOPLIST_KEY_UILaunchScreen_Generation = YES;
				INFOPLIST_KEY_UISupportedInterfaceOrientations_iPad = "UIInterfaceOrientationPortrait UIInterfaceOrientationPortraitUpsideDown UIInterfaceOrientationLandscapeLeft UIInterfaceOrientationLandscapeRight";
				INFOPLIST_KEY_UISupportedInterfaceOrientations_iPhone = "UIInterfaceOrientationPortrait UIInterfaceOrientationLandscapeLeft UIInterfaceOrientationLandscapeRight";
				LD_RUNPATH_SEARCH_PATHS = (
					"$(inherited)",
					"@executable_path/Frameworks",
				);
				MARKETING_VERSION = 1.0;
				PRODUCT_BUNDLE_IDENTIFIER = "${bundleId}";
				PRODUCT_NAME = "$(TARGET_NAME)";
				SWIFT_EMIT_LOC_STRINGS = YES;
				SWIFT_VERSION = 5.0;
				TARGETED_DEVICE_FAMILY = "1,2";
			};
			name = Release;
		};
		${ids.testDebugConfig} /* Debug */ = {
			isa = XCBuildConfiguration;
			buildSettings = {
				BUNDLE_LOADER = "$(TEST_HOST)";
				CODE_SIGN_STYLE = Automatic;
				CURRENT_PROJECT_VERSION = 1;
				DEVELOPMENT_TEAM = "";
				GENERATE_INFOPLIST_FILE = YES;
				IPHONEOS_DEPLOYMENT_TARGET = 17.0;
				MARKETING_VERSION = 1.0;
				PRODUCT_BUNDLE_IDENTIFIER = "${bundleId}.tests";
				PRODUCT_NAME = "$(TARGET_NAME)";
				SWIFT_EMIT_LOC_STRINGS = NO;
				SWIFT_VERSION = 5.0;
				TARGETED_DEVICE_FAMILY = "1,2";
				TEST_HOST = "$(BUILT_PRODUCTS_DIR)/${className}.app/$(BUNDLE_EXECUTABLE_FOLDER_PATH)/${className}";
			};
			name = Debug;
		};
		${ids.testReleaseConfig} /* Release */ = {
			isa = XCBuildConfiguration;
			buildSettings = {
				BUNDLE_LOADER = "$(TEST_HOST)";
				CODE_SIGN_STYLE = Automatic;
				CURRENT_PROJECT_VERSION = 1;
				DEVELOPMENT_TEAM = "";
				GENERATE_INFOPLIST_FILE = YES;
				IPHONEOS_DEPLOYMENT_TARGET = 17.0;
				MARKETING_VERSION = 1.0;
				PRODUCT_BUNDLE_IDENTIFIER = "${bundleId}.tests";
				PRODUCT_NAME = "$(TARGET_NAME)";
				SWIFT_EMIT_LOC_STRINGS = NO;
				SWIFT_VERSION = 5.0;
				TARGETED_DEVICE_FAMILY = "1,2";
				TEST_HOST = "$(BUILT_PRODUCTS_DIR)/${className}.app/$(BUNDLE_EXECUTABLE_FOLDER_PATH)/${className}";
			};
			name = Release;
		};
/* End XCBuildConfiguration section */

/* Begin XCConfigurationList section */
		${ids.projectConfigList} /* Build configuration list for PBXProject "${className}" */ = {
			isa = XCConfigurationList;
			buildConfigurations = (
				${ids.debugConfig} /* Debug */,
				${ids.releaseConfig} /* Release */,
			);
			defaultConfigurationIsVisible = 0;
			defaultConfigurationName = Release;
		};
		${ids.appConfigList} /* Build configuration list for PBXNativeTarget "${className}" */ = {
			isa = XCConfigurationList;
			buildConfigurations = (
				${ids.appDebugConfig} /* Debug */,
				${ids.appReleaseConfig} /* Release */,
			);
			defaultConfigurationIsVisible = 0;
			defaultConfigurationName = Release;
		};
		${ids.testConfigList} /* Build configuration list for PBXNativeTarget "${className}Tests" */ = {
			isa = XCConfigurationList;
			buildConfigurations = (
				${ids.testDebugConfig} /* Debug */,
				${ids.testReleaseConfig} /* Release */,
			);
			defaultConfigurationIsVisible = 0;
			defaultConfigurationName = Release;
		};
/* End XCConfigurationList section */
	};
	rootObject = ${ids.project} /* Project object */;
}
`;
}

export default { generateFullProject };
