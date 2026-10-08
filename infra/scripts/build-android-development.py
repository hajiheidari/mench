"""Build the cloud's debug-signed ARM64 development APK with verified tools."""
import os
import subprocess
import urllib.parse
from pathlib import Path

repo = Path(__file__).resolve().parents[2]
base = Path(os.environ.get('MENCH_TOOLCHAIN_ROOT', '/workspace/mench-toolchains'))
env = os.environ.copy()
env.update(JAVA_HOME=str(base / 'java17/usr/lib/jvm/java-17-openjdk-amd64'),
           ANDROID_HOME=str(base / 'android'),
           ANDROID_USER_HOME=str(base / 'android-user'),
           GRADLE_USER_HOME=str(base / 'gradle'), EXPO_NO_TELEMETRY='1', CI='1')
android = repo / 'apps/mobile/android'
if not (android / 'gradlew').is_file():
    raise SystemExit('Generate Android first: CI=1 npx expo prebuild --platform android --no-install in apps/mobile')
subprocess.run(['python3', str(repo / 'infra/scripts/verify-gradle-wrapper.py'),
                'gradle/wrapper/gradle-wrapper.properties'], cwd=android, check=True)
options = []
if (base / 'java-truststore').is_file():
    options += [f'-Djavax.net.ssl.trustStore={base}/java-truststore',
                '-Djavax.net.ssl.trustStorePassword=changeit']
if env.get('HTTPS_PROXY'):
    proxy = urllib.parse.urlsplit(env['HTTPS_PROXY'])
    options += [f'-Dhttps.proxyHost={proxy.hostname}', f'-Dhttps.proxyPort={proxy.port or 80}',
                f'-Dhttp.proxyHost={proxy.hostname}', f'-Dhttp.proxyPort={proxy.port or 80}',
                '-Dhttp.nonProxyHosts=localhost|127.*']
if options:
    env['GRADLE_OPTS'] = ' '.join(options)
result = subprocess.run(['./gradlew', 'app:assembleRelease', '--no-daemon', '--max-workers=4',
                         '-PreactNativeArchitectures=arm64-v8a',
                         '-Pkotlin.compiler.execution.strategy=in-process',
                         '-Dorg.gradle.jvmargs=-Xmx4096m -XX:MaxMetaspaceSize=1024m',
                         '--console=plain'], cwd=android, env=env)
raise SystemExit(result.returncode)
