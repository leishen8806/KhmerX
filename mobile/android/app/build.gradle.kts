import java.util.Properties

plugins {
    id("com.android.application")
    id("kotlin-android")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

android {
    namespace = "org.khmerx.khmerx_app"
    compileSdk = flutter.compileSdkVersion
    buildToolsVersion = "34.0.0"
    ndkVersion = "27.0.12077973"

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlin {
        compilerOptions {
            jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17)
        }
    }

    defaultConfig {
        applicationId = "org.khmerx.khmerx_app"
        minSdk = flutter.minSdkVersion
        targetSdk = 34
        versionCode = 1
        versionName = "0.1.0"
    }

    // Release signing comes from android/key.properties (never committed):
    //   storeFile=/path/to/upload-keystore.jks
    //   storePassword=...  keyAlias=...  keyPassword=...
    // Without it a release build fails; it is never signed with the debug key.
    val keyProps = Properties()
    val keyPropsFile = rootProject.file("key.properties")
    if (keyPropsFile.exists()) keyPropsFile.inputStream().use { keyProps.load(it) }

    signingConfigs {
        if (keyPropsFile.exists()) {
            create("release") {
                storeFile = file(keyProps.getProperty("storeFile"))
                storePassword = keyProps.getProperty("storePassword")
                keyAlias = keyProps.getProperty("keyAlias")
                keyPassword = keyProps.getProperty("keyPassword")
            }
        }
    }

    // Internal test builds only: KHMERX_INTERNAL_SIGNING=1 signs the release
    // build with the local debug key so testers can install it. Such a build
    // is NOT for any store and cannot be updated by a properly signed build.
    val internalSigning = System.getenv("KHMERX_INTERNAL_SIGNING") == "1"

    buildTypes {
        release {
            if (keyPropsFile.exists()) {
                signingConfig = signingConfigs.getByName("release")
            } else if (internalSigning) {
                signingConfig = signingConfigs.getByName("debug")
            }
        }
    }
}

gradle.taskGraph.whenReady {
    val wantsRelease = allTasks.any {
        it.name.contains("Release") && (it.name.startsWith("assemble") || it.name.startsWith("bundle") || it.name.startsWith("package"))
    }
    val internalSigning = System.getenv("KHMERX_INTERNAL_SIGNING") == "1"
    if (wantsRelease && !internalSigning && !rootProject.file("key.properties").exists()) {
        throw GradleException(
            "Release build requires android/key.properties with the upload keystore. " +
                "Refusing to sign a release with the debug key " +
                "(internal test builds: set KHMERX_INTERNAL_SIGNING=1)."
        )
    }
}

flutter {
    source = "../.."
}
