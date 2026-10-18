plugins { id("com.android.application"); id("org.jetbrains.kotlin.android") }

android {
    namespace = "org.nuanban.nativelab"
    compileSdk = 36
    defaultConfig {
        applicationId = "org.nuanban.nativelab"
        minSdk = 26
        targetSdk = 36
        versionCode = 1
        versionName = "0.1.0-c01-lab"
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

kotlin { compilerOptions { jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17) } }
