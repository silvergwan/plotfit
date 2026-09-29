# 항목별 프로필 입력

외모(appearance), 성격(personality), 배경(background), 기타(other)를 각각
`{ text: string, preserve: boolean }`으로 전달한다. 네 항목의 키와 유지 여부는
필수지만 text는 빈 문자열을 허용한다. 최소 한 항목은 비어 있지 않아야 한다.

```json
{
  "profile": {
    "appearance": { "text": "185cm, 78kg", "preserve": true },
    "personality": { "text": "배려심이 많음", "preserve": true },
    "background": { "text": "경찰이 되는 것이 꿈", "preserve": false },
    "other": { "text": "", "preserve": true }
  },
  "plotContent": "왕국의 경비대가 등장하는 판타지 세계관"
}
```

- 유지 선택은 기본 true다. 선택하면 의미와 수치를 유지하고 표현만 다듬도록 요청한다.
- 해제는 삭제가 아니다. 충돌하는 설정만 세계관에 맞게 조정하도록 요청한다.
- 빈 항목은 유지 여부와 관계없이 정보 없음으로 처리한다.
- 네 항목은 각각 trim한 뒤 합계 2,000자, 플롯은 trim 후 10,000자까지 허용한다.
- 화면과 서버는 같은 입력 스키마를 사용한다. 원문·체크 상태를 분석 이벤트에 추가하지 않는다.
- 서버는 검증된 JSON을 모델에 전달한다. 새 프롬프트는 유지 선택을 세계관 조정보다 우선한다.
- 응답의 appearance / traits / plot_position 및 _meta 구조는 유지한다.
  Zod는 출력 구조를 검증하며 의미 보존 여부를 보장하지 않는다.

## 호환성과 평가

이 API는 기존 baseProfile 문자열 요청을 400으로 거절한다. 화면과 API를 함께 배포한다.
기존 페이지를 열어둔 사용자는 새로고침해야 한다.

과거 평가 스크립트와 결과는 보존하며 기존 lib/prompts.ts를 그대로 사용한다.
운영 API는 lib/structured-profile-prompt.ts를 사용하므로 과거 100케이스 결과는
이번 입력·프롬프트 변경의 품질 검증 결과가 아니다. 새 의미 보존 품질은 별도 평가가 필요하다.

## 확인 방법

`npm test`는 외부 SDK를 대체해 입력 경계, 잘못된 중첩 타입, 유지 여부의 전달,
한 항목 입력, 요청 제한 및 장애 응답을 검증한다. 실제 모델의 의미 보존은 검증하지 않는다.
브라우저에서는 네 입력과 체크박스, 빈 입력 오류, 글자 수 안내를 확인한다.
