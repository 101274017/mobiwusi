import argparse
import hashlib
import importlib.metadata
import json
import mimetypes
from datetime import datetime
from pathlib import Path
from urllib.parse import unquote, urlparse

from playwright.sync_api import expect, sync_playwright


def run():
    parser = argparse.ArgumentParser()
    parser.add_argument('--base-url', default='http://127.0.0.1:4173')
    parser.add_argument('--channel', default='chrome')
    arguments = parser.parse_args()
    root = Path(__file__).resolve().parents[2]
    web = root / 'apps/web/dist'
    evidence = root / 'docs/implementation/evidence'
    screenshots = evidence / 'screenshots'
    screenshots.mkdir(parents=True, exist_ok=True)
    metadata = {'generatedAt': datetime.now().astimezone().isoformat(), 'artifact': 'apps/web/dist', 'webIndexSha256': hashlib.sha256((web / 'index.html').read_bytes()).hexdigest(), 'playwrightPython': importlib.metadata.version('playwright'), 'channel': arguments.channel, 'deviceVerified': False}
    report = {**metadata, 'source': 'built-static-ui', 'pageErrors': [], 'pages': [], 'passed': False}
    native = {**metadata, 'source': 'Chrome-simulated-Android-message-channel', 'realWebViewVerified': False, 'cases': [], 'passed': False}

    def error_listener(label):
        return lambda error: report['pageErrors'].append({'case': label, 'error': str(error)})

    def fulfill_local(route):
        prefix = '/assets/ui/'
        pathname = unquote(urlparse(route.request.url).path)
        target = (web / pathname[len(prefix):]).resolve()
        if not pathname.startswith(prefix) or not target.is_relative_to(web.resolve()) or not target.is_file():
            route.abort()
            return
        content_type = 'text/javascript' if target.suffix == '.js' else mimetypes.guess_type(str(target))[0] or 'application/octet-stream'
        route.fulfill(path=str(target), content_type=content_type)

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(channel=arguments.channel, headless=True)
        try:
            for name, viewport in [('desktop', {'width': 1440, 'height': 1000}), ('mobile', {'width': 390, 'height': 844})]:
                for scene in ['pet-settings', 'conflicts', 'account-demo', 'native-stop-failure']:
                    context = browser.new_context(viewport=viewport, reduced_motion='reduce')
                    page = context.new_page()
                    page.set_default_timeout(10000)
                    page.on('pageerror', error_listener(scene + '-' + name))
                    if scene == 'native-stop-failure':
                        page.add_init_script("window.nuanbanHost={platform:'windows',capabilities:async()=>({platform:'windows'}),stopAll:async()=>{throw new Error('synthetic stop failure')}}")
                    route = {'pet-settings': '/pets', 'conflicts': '/notes/demo-note-font?scenario=version-conflict', 'account-demo': '/onboarding/login', 'native-stop-failure': '/chat/new'}[scene]
                    page.goto(arguments.base_url + '/#' + route, wait_until='networkidle')
                    if scene == 'pet-settings':
                        expect(page.get_by_role('region', name='桌宠微调预览')).to_be_visible()
                        page.get_by_role('button', name='小白兔', exact=True).click()
                        page.get_by_label('眼睛', exact=True).select_option('happy')
                        page.get_by_label('嘴型', exact=True).select_option('open')
                        page.get_by_label('动作姿态', exact=True).select_option('greeting')
                    elif scene == 'conflicts':
                        page.get_by_role('button', name='我确认已经掌握').click()
                        page.get_by_role('button', name='确认更改状态').click()
                        expect(page.get_by_role('dialog').get_by_role('alert')).to_contain_text('草稿已保留')
                        page.get_by_role('button', name='关闭窗口').click()
                        page.get_by_role('link', name='比较并选择冲突内容').click()
                        expect(page.get_by_role('region', name='本机未保存草稿')).to_be_visible()
                        expect(page.get_by_role('region', name='另一份模拟版本')).to_be_visible()
                        expect(page.get_by_role('button', name='核对选择并继续')).to_be_disabled()
                        page.get_by_role('button', name='关闭错误提示').click()
                    elif scene == 'account-demo':
                        page.get_by_label('被开通者', exact=True).select_option('child')
                        page.get_by_role('radio', name='社区批次中的本人认领').check()
                        page.get_by_role('checkbox', name='模拟协助者已认证且具备开通权限').check()
                        page.get_by_role('checkbox', name='已阅读：只演练流程，不采集或认证真实身份').check()
                        page.get_by_role('button', name='开始这条路径的演练').click()
                        expect(page.get_by_role('heading', name='等待本人或有效监护人确认')).to_be_visible()
                    else:
                        page.get_by_role('button', name='随时停止', exact=True).click()
                        expect(page.get_by_role('alert')).to_contain_text('原生停止未确认')
                    page.evaluate('window.scrollTo(0, 0)')
                    overflow = page.evaluate('document.documentElement.scrollWidth > window.innerWidth')
                    skip_hidden = page.locator('.skip-link').evaluate('element => element.getBoundingClientRect().bottom < 0')
                    assert not overflow and skip_hidden, (scene, name, overflow, skip_hidden)
                    image = screenshots / f'{scene}-{name}.png'
                    page.screenshot(path=str(image), full_page=True, animations='disabled')
                    report['pages'].append({'scene': scene, 'viewport': viewport, 'horizontalOverflow': overflow, 'skipLinkHiddenUntilFocus': skip_hidden, 'screenshot': image.relative_to(root).as_posix()})
                    context.close()

                context = browser.new_context(viewport=viewport, reduced_motion='reduce')
                page = context.new_page()
                page.on('pageerror', error_listener('android-message-simulation-' + name))
                page.route('https://appassets.androidplatform.net/**', fulfill_local)
                page.add_init_script("""
                    window.syntheticBridgeMessages=[];
                    window.nuanbanBridge={onmessage:null,postMessage(payload){
                        const request=JSON.parse(payload);
                        window.syntheticBridgeMessages.push(request);
                        const correlation={request_id:request.request_id,generation:request.generation};
                        const response=request.method==='capabilities'
                            ? {...correlation,platform:'android',externalCapture:false,nativeOverlay:false,remoteMedia:false,status:'native-skeleton'}
                            : {...correlation,stopped:true,captureActive:false};
                        queueMicrotask(()=>window.nuanbanBridge.onmessage?.({data:JSON.stringify(response)}));
                    }};
                """)
                page.goto('https://appassets.androidplatform.net/assets/ui/index.html', wait_until='networkidle')
                expect(page.get_by_role('heading', name='你好，今天也有暖伴陪着你。')).to_be_visible()
                page.wait_for_function("window.syntheticBridgeMessages.some(message=>message.method==='capabilities')")
                page.get_by_role('button', name='随时停止', exact=True).click()
                page.wait_for_function("window.syntheticBridgeMessages.filter(message=>message.method==='stop_all').length===1")
                page.evaluate("window.dispatchEvent(new Event('nuanban:host-pause'))")
                page.wait_for_function("window.syntheticBridgeMessages.filter(message=>message.method==='stop_all').length===2")
                messages = page.evaluate('window.syntheticBridgeMessages')
                assert [message['method'] for message in messages] == ['capabilities', 'stop_all', 'stop_all']
                assert [message['generation'] for message in messages] == [0, 1, 2]
                assert len({message['request_id'] for message in messages}) == 3
                assert all(set(message) == {'version', 'request_id', 'generation', 'method'} and message['version'] == 1 for message in messages)
                expect(page.get_by_role('alert')).to_have_count(0)
                image = screenshots / f'android-bridge-simulated-{name}.png'
                page.evaluate('window.scrollTo(0, 0)')
                page.screenshot(path=str(image), full_page=True, animations='disabled')
                native['cases'].append({'viewport': viewport, 'messages': messages, 'screenshot': image.relative_to(root).as_posix(), 'transportSimulated': True})
                context.close()
            assert not report['pageErrors'], report['pageErrors']
            report['passed'] = True
            native['passed'] = True
        finally:
            browser.close()
            (evidence / 'ui-smoke.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
            (evidence / 'android-browser-bridge.json').write_text(json.dumps(native, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'passed': report['passed'], 'uiCases': len(report['pages']), 'simulatedAndroidCases': len(native['cases']), 'realWebViewVerified': False}, ensure_ascii=False))


if __name__ == '__main__':
    run()
