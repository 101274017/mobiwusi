plugins { id("com.android.application"); id("org.jetbrains.kotlin.android"); id("org.jetbrains.kotlin.kapt") }
android {
    namespace = "org.nuanban.assistant"
    compileSdk = 36
    defaultConfig { applicationId = "org.nuanban.assistant"; minSdk = 26; targetSdk = 36; versionCode = 1; versionName = "0.1.0-demo" }
    compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
    kotlinOptions { jvmTarget = "17" }
    sourceSets["main"].java.srcDir(rootProject.file("../../packages/contracts/kotlin/src/main/kotlin"))
    sourceSets["main"].java.srcDir("src/normal/java")
}
dependencies {
    implementation("androidx.webkit:webkit:1.14.0")
    implementation("androidx.room:room-runtime:2.8.5")
    kapt("androidx.room:room-compiler:2.8.5")
}

kapt { correctErrorTypes = true }
