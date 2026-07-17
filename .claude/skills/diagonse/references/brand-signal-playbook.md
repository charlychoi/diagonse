# 브랜드 검색 신호 정렬 플레이북

## 목표

네이버에서:

1. `{회사명}` 단독 검색 → 무슨 일을 하는 회사인지 **즉시** 드러남  
2. `{회사명} {핵심서비스}` 검색 → 공식 홈·콘텐츠가 관련 결과로 잡힐 **확률** 상승  

HTML 가이드(robots, canonical 등)는 **전제**. 성과 KPI는 **브랜드 검색 스니펫 정체성 + 문의**.

## 실패 모드 (before_after.md)

| 현상 | 원인 |
|------|------|
| title에 서비스 단어는 있음 | H1이 로고/인증 배지 → 주제 신호 실패 |
| 미션 슬로건만 description | 검색 의도에 서비스·전문이 안 붙음 |
| 히어로가 이미지 카피 | 로봇이 첫 화면 메시지를 못 읽음 |
| 홈만 고침 | 블로그·플레이스 메시지 분산 |

**단어 있음 ≠ 신호 강함.** title·desc·H1에 **동시에** 브랜드+서비스가 있어야 묶임.

## 신호 매트릭스

| 키워드 | title | description | H1 | 역할 |
|--------|-------|-------------|-----|------|
| 브랜드 | ? | ? | ? | 단독 검색 주체 |
| 핵심 서비스 | ? | ? | ? | 무엇을 하는 회사 |
| 전문 | ? | ? | ? | 포지셔닝 강도 |

## Before → After 원칙

- title 앞: `{브랜드} | {서비스} 전문 …`
- H1: 페이지당 1개, 서비스 주제 (인증은 H1 밖)
- description 첫 문장: `{브랜드}는 {서비스} 전문`
- 히어로: HTML 텍스트 + 짧은 alt
- 채널명에도 동일 메시지

## 실검색 KPI (사람/에이전트가 링크 열기)

- `https://m.search.naver.com/search.naver?query={브랜드}`
- `https://m.search.naver.com/search.naver?query={브랜드}+{서비스}`
- `https://m.search.naver.com/search.naver?query={서비스}`
- `https://m.search.naver.com/search.naver?query=site:{hostname}`

순위 보장 문구 금지. 수정 전후 스니펫 캡처 권장.
