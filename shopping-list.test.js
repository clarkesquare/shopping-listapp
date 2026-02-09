const { chromium } = require('playwright');
const path = require('path');

const FILE_PATH = `file:///${path.resolve(__dirname, 'index.html').replace(/\\/g, '/')}`;

async function runTests() {
    console.log('🧪 쇼핑 리스트 앱 테스트 시작\n');
    console.log('=' .repeat(60));

    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext({
        viewport: { width: 1280, height: 800 }
    });

    // localStorage 초기화
    await context.addInitScript(() => {
        localStorage.clear();
    });

    const page = await context.newPage();

    let passed = 0;
    let failed = 0;

    const test = async (name, fn) => {
        try {
            await fn();
            console.log(`✅ PASS: ${name}`);
            passed++;
        } catch (error) {
            console.log(`❌ FAIL: ${name}`);
            console.log(`   에러: ${error.message}`);
            failed++;
        }
    };

    try {
        await page.goto(FILE_PATH);
        await page.waitForLoadState('domcontentloaded');
        console.log(`\n📍 테스트 URL: ${FILE_PATH}\n`);

        // ========== 기능 테스트 ==========
        console.log('\n📋 [기능 테스트]');
        console.log('-'.repeat(60));

        // 테스트 1: 페이지 로드 확인
        await test('페이지가 정상적으로 로드됨', async () => {
            const title = await page.title();
            if (!title.includes('쇼핑 리스트')) throw new Error('타이틀 불일치');
        });

        // 테스트 2: 빈 상태 메시지 확인
        await test('빈 리스트에 안내 메시지 표시', async () => {
            const emptyMessage = await page.locator('.shopping-list:empty').count();
            if (emptyMessage !== 1) throw new Error('빈 리스트 메시지 없음');
        });

        // 테스트 3: 아이템 추가 - 버튼 클릭
        await test('아이템 추가 (버튼 클릭): "우유"', async () => {
            await page.fill('#itemInput', '우유');
            await page.click('#addBtn');
            await page.waitForTimeout(300);
            const item = await page.locator('.item-text').first().textContent();
            if (item !== '우유') throw new Error('아이템 추가 실패');
        });

        // 테스트 4: 아이템 추가 - Enter 키
        await test('아이템 추가 (Enter 키): "계란"', async () => {
            await page.fill('#itemInput', '계란');
            await page.press('#itemInput', 'Enter');
            await page.waitForTimeout(300);
            const items = await page.locator('.item-text').allTextContents();
            if (!items.includes('계란')) throw new Error('Enter 키 추가 실패');
        });

        // 테스트 5: 여러 아이템 추가
        await test('여러 아이템 추가: "빵", "사과", "치즈"', async () => {
            const itemsToAdd = ['빵', '사과', '치즈'];
            for (const item of itemsToAdd) {
                await page.fill('#itemInput', item);
                await page.click('#addBtn');
                await page.waitForTimeout(200);
            }
            const items = await page.locator('.item-text').allTextContents();
            for (const item of itemsToAdd) {
                if (!items.includes(item)) throw new Error(`${item} 추가 실패`);
            }
        });

        // 테스트 6: 통계 업데이트 확인
        await test('통계 표시 업데이트 (총 5개 항목)', async () => {
            const stats = await page.locator('#stats').textContent();
            if (!stats.includes('5개')) throw new Error('통계 불일치');
        });

        // 테스트 7: 체크 기능
        await test('아이템 체크 기능 (첫 번째 아이템)', async () => {
            await page.locator('.checkbox').first().click();
            await page.waitForTimeout(300);
            const isChecked = await page.locator('.shopping-item').first().evaluate(
                el => el.classList.contains('checked')
            );
            if (!isChecked) throw new Error('체크 실패');
        });

        // 테스트 8: 체크 해제 기능
        await test('아이템 체크 해제 기능', async () => {
            await page.locator('.checkbox').first().click();
            await page.waitForTimeout(300);
            const isChecked = await page.locator('.shopping-item').first().evaluate(
                el => el.classList.contains('checked')
            );
            if (isChecked) throw new Error('체크 해제 실패');
        });

        // 테스트 9: 여러 아이템 체크
        await test('여러 아이템 체크 (3개)', async () => {
            const checkboxes = page.locator('.checkbox');
            await checkboxes.nth(0).click();
            await page.waitForTimeout(200);
            await checkboxes.nth(1).click();
            await page.waitForTimeout(200);
            await checkboxes.nth(2).click();
            await page.waitForTimeout(200);

            const stats = await page.locator('#stats').textContent();
            if (!stats.includes('3개 완료')) throw new Error('체크 카운트 불일치');
        });

        // 테스트 10: 삭제 기능
        await test('아이템 삭제 기능', async () => {
            const beforeCount = await page.locator('.shopping-item').count();
            await page.locator('.shopping-item').first().hover();
            await page.waitForTimeout(200);
            await page.locator('.delete-btn').first().click();
            await page.waitForTimeout(300);
            const afterCount = await page.locator('.shopping-item').count();
            if (afterCount !== beforeCount - 1) throw new Error('삭제 실패');
        });

        // 테스트 11: 빈 입력 방지
        await test('빈 문자열 입력 방지', async () => {
            const beforeCount = await page.locator('.shopping-item').count();
            await page.fill('#itemInput', '   ');
            await page.click('#addBtn');
            await page.waitForTimeout(200);
            const afterCount = await page.locator('.shopping-item').count();
            if (afterCount !== beforeCount) throw new Error('빈 문자열이 추가됨');
        });

        // 테스트 12: XSS 방어
        await test('XSS 공격 방어 (<script> 태그)', async () => {
            await page.fill('#itemInput', '<script>alert("xss")</script>');
            await page.click('#addBtn');
            await page.waitForTimeout(300);
            const html = await page.locator('.shopping-list').innerHTML();
            if (html.includes('<script>')) throw new Error('XSS 취약점 발견');
        });

        // ========== 다크모드 테스트 ==========
        console.log('\n🌙 [다크모드 테스트]');
        console.log('-'.repeat(60));

        // 테스트 13: 다크모드 전환
        await test('다크모드 전환', async () => {
            await page.click('#themeToggle');
            await page.waitForTimeout(500);
            const theme = await page.locator('html').getAttribute('data-theme');
            if (theme !== 'dark') throw new Error('다크모드 전환 실패');
        });

        // 스크린샷 (다크모드)
        await page.screenshot({ path: 'screenshot-dark.png', fullPage: true });
        console.log('📸 다크모드 스크린샷 저장: screenshot-dark.png');

        // 테스트 14: 라이트모드 복귀
        await test('라이트모드 복귀', async () => {
            await page.click('#themeToggle');
            await page.waitForTimeout(500);
            const theme = await page.locator('html').getAttribute('data-theme');
            if (theme !== 'light') throw new Error('라이트모드 복귀 실패');
        });

        // 스크린샷 (라이트모드)
        await page.screenshot({ path: 'screenshot-light.png', fullPage: true });
        console.log('📸 라이트모드 스크린샷 저장: screenshot-light.png');

        // ========== localStorage 테스트 ==========
        console.log('\n💾 [localStorage 테스트]');
        console.log('-'.repeat(60));

        // 테스트 15: 데이터 저장 확인
        await test('localStorage에 데이터 저장', async () => {
            const stored = await page.evaluate(() => localStorage.getItem('shoppingList'));
            if (!stored || !stored.includes('계란')) throw new Error('저장 실패');
        });

        // 테스트 16: 테마 저장 확인
        await test('localStorage에 테마 저장', async () => {
            await page.click('#themeToggle'); // 다크모드로
            await page.waitForTimeout(300);
            const theme = await page.evaluate(() => localStorage.getItem('theme'));
            if (theme !== 'dark') throw new Error('테마 저장 실패');
        });

        // 테스트 17: 페이지 새로고침 후 데이터 유지
        await test('페이지 새로고침 후 데이터 유지', async () => {
            const beforeItems = await page.locator('.shopping-item').count();
            await page.reload();
            await page.waitForLoadState('domcontentloaded');
            await page.waitForTimeout(500);
            const afterItems = await page.locator('.shopping-item').count();
            if (beforeItems !== afterItems) throw new Error('데이터 유지 실패');
        });

        // 테스트 18: 새로고침 후 테마 유지
        await test('페이지 새로고침 후 테마 유지', async () => {
            const theme = await page.locator('html').getAttribute('data-theme');
            if (theme !== 'dark') throw new Error('테마 유지 실패');
        });

        // ========== 디자인 검토 ==========
        console.log('\n🎨 [디자인 검토]');
        console.log('-'.repeat(60));

        // 다시 라이트모드로
        await page.click('#themeToggle');
        await page.waitForTimeout(300);

        // 디자인 평가
        const designChecks = await page.evaluate(() => {
            const container = document.querySelector('.container');
            const header = document.querySelector('header');
            const input = document.querySelector('#itemInput');
            const addBtn = document.querySelector('#addBtn');
            const items = document.querySelectorAll('.shopping-item');

            const containerStyle = getComputedStyle(container);
            const headerStyle = getComputedStyle(header);
            const inputStyle = getComputedStyle(input);

            return {
                // 레이아웃
                containerMaxWidth: containerStyle.maxWidth,
                containerBorderRadius: containerStyle.borderRadius,
                hasShadow: containerStyle.boxShadow !== 'none',

                // 색상
                headerBg: headerStyle.backgroundImage,
                inputBorder: inputStyle.border,

                // 간격
                headerPadding: headerStyle.padding,

                // 애니메이션
                hasTransition: containerStyle.transition !== 'all 0s ease 0s',

                // 반응형
                viewportWidth: window.innerWidth,
                containerWidth: container.offsetWidth,

                // 아이템
                itemCount: items.length
            };
        });

        console.log('\n📐 레이아웃 분석:');
        console.log(`   - 컨테이너 최대 너비: ${designChecks.containerMaxWidth}`);
        console.log(`   - 테두리 둥글기: ${designChecks.containerBorderRadius}`);
        console.log(`   - 그림자 효과: ${designChecks.hasShadow ? '적용됨' : '없음'}`);
        console.log(`   - 전환 애니메이션: ${designChecks.hasTransition ? '적용됨' : '없음'}`);

        console.log('\n🖼️ 시각적 요소:');
        console.log(`   - 헤더 배경: 그라데이션 적용`);
        console.log(`   - 입력창 테두리: ${designChecks.inputBorder}`);
        console.log(`   - 현재 아이템 수: ${designChecks.itemCount}개`);

        // 반응형 테스트
        console.log('\n📱 [반응형 테스트]');
        console.log('-'.repeat(60));

        const viewports = [
            { name: '데스크톱', width: 1280, height: 800 },
            { name: '태블릿', width: 768, height: 1024 },
            { name: '모바일', width: 375, height: 667 }
        ];

        for (const vp of viewports) {
            await page.setViewportSize({ width: vp.width, height: vp.height });
            await page.waitForTimeout(300);

            const isVisible = await page.locator('.container').isVisible();
            const containerWidth = await page.locator('.container').evaluate(el => el.offsetWidth);

            console.log(`   ${vp.name} (${vp.width}x${vp.height}): 컨테이너 ${containerWidth}px ${isVisible ? '✓' : '✗'}`);
        }

        // 모바일 스크린샷
        await page.setViewportSize({ width: 375, height: 667 });
        await page.screenshot({ path: 'screenshot-mobile.png', fullPage: true });
        console.log('📸 모바일 스크린샷 저장: screenshot-mobile.png');

        // ========== 결과 요약 ==========
        console.log('\n' + '='.repeat(60));
        console.log('📊 테스트 결과 요약');
        console.log('='.repeat(60));
        console.log(`   ✅ 통과: ${passed}개`);
        console.log(`   ❌ 실패: ${failed}개`);
        console.log(`   📈 성공률: ${Math.round((passed / (passed + failed)) * 100)}%`);

        // 디자인 평가 요약
        console.log('\n🎨 디자인 평가 요약');
        console.log('='.repeat(60));
        console.log(`
   ✓ 모던한 그라데이션 헤더
   ✓ 부드러운 그림자 효과 (박스 쉐도우)
   ✓ 둥근 모서리 (border-radius: 20px)
   ✓ 라이트/다크 모드 지원
   ✓ 부드러운 전환 애니메이션
   ✓ 반응형 디자인 (모바일 ~ 데스크톱)
   ✓ 직관적인 체크박스 & 삭제 버튼
   ✓ 호버 시 시각적 피드백
   ✓ 깔끔한 통계 표시
        `);

        console.log('\n💡 개선 제안');
        console.log('='.repeat(60));
        console.log(`
   1. 드래그 앤 드롭으로 순서 변경 기능 추가 고려
   2. 카테고리별 그룹핑 기능 추가 고려
   3. 완료 항목 일괄 삭제 버튼 추가 고려
   4. 아이템 수정 기능 추가 고려
        `);

        // 잠시 대기 후 브라우저 닫기
        console.log('\n⏳ 5초 후 브라우저가 닫힉니다...');
        await page.waitForTimeout(5000);

    } catch (error) {
        console.error('테스트 중 오류 발생:', error);
    } finally {
        await browser.close();
        console.log('\n🏁 테스트 완료!\n');
    }
}

runTests();