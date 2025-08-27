/**
 * TTS (Text-to-Speech) 유틸리티 함수들
 * TTS 관련 텍스트 정리 및 처리 기능
 */

// --- TTS용 텍스트 정리 함수 ---
function cleanTextForTTS(text) {
    if (!text || typeof text !== 'string') {
        console.warn('[TTS] 유효하지 않은 텍스트:', text);
        return null;
    }
    
    console.log('[TTS] 원본 텍스트:', text);
    
    // 1. HTML 태그 및 SSML 태그 제거
    let cleanText = text
        .replace(/<[^>]*>/g, '') // HTML 태그 제거
        .replace(/<speak[^>]*>/gi, '') // SSML speak 태그 제거
        .replace(/<\/speak>/gi, '') // SSML speak 닫기 태그 제거
        .replace(/<prosody[^>]*>/gi, '') // SSML prosody 태그 제거
        .replace(/<\/prosody>/gi, '') // SSML prosody 닫기 태그 제거
        .replace(/<voice[^>]*>/gi, '') // SSML voice 태그 제거
        .replace(/<\/voice>/gi, '') // SSML voice 닫기 태그 제거
        .replace(/<break[^>]*>/gi, '') // SSML break 태그 제거
        .replace(/<emphasis[^>]*>/gi, '') // SSML emphasis 태그 제거
        .replace(/<\/emphasis>/gi, '') // SSML emphasis 닫기 태그 제거
        .replace(/<say-as[^>]*>/gi, '') // SSML say-as 태그 제거
        .replace(/<\/say-as>/gi, '') // SSML say-as 닫기 태그 제거
        .replace(/<phoneme[^>]*>/gi, '') // SSML phoneme 태그 제거
        .replace(/<\/phoneme>/gi, '') // SSML phoneme 닫기 태그 제거
        .replace(/<sub[^>]*>/gi, '') // SSML sub 태그 제거
        .replace(/<\/sub>/gi, '') // SSML sub 닫기 태그 제거
        .replace(/<audio[^>]*>/gi, '') // SSML audio 태그 제거
        .replace(/<mark[^>]*>/gi, '') // SSML mark 태그 제거
        .replace(/<bookmark[^>]*>/gi, '') // SSML bookmark 태그 제거
        .replace(/<p[^>]*>/gi, '') // SSML p 태그 제거
        .replace(/<\/p>/gi, '') // SSML p 닫기 태그 제거
        .replace(/<s[^>]*>/gi, '') // SSML s 태그 제거
        .replace(/<\/s>/gi, '') // SSML s 닫기 태그 제거
        .replace(/<w[^>]*>/gi, '') // SSML w 태그 제거
        .replace(/<\/w>/gi, '') // SSML w 닫기 태그 제거
        .replace(/<m[^>]*>/gi, '') // SSML m 태그 제거
        .replace(/<\/m>/gi, '') // SSML m 닫기 태그 제거
        .replace(/<t[^>]*>/gi, '') // SSML t 태그 제거
        .replace(/<\/t>/gi, '') // SSML t 닫기 태그 제거
        .replace(/xmlns="[^"]*"/gi, '') // XML 네임스페이스 제거
        .replace(/xml:lang="[^"]*"/gi, '') // XML 언어 속성 제거
        .replace(/version="[^"]*"/gi, ''); // XML 버전 속성 제거
    
    // 2. 특수 문자 및 이모지 정리
    cleanText = cleanText
        .replace(/[🎤🎬📹🎥🎭🎪🎨🎯🎲🎮🎰🎱🎳🎴🎵🎶🎷🎸🎹🎺🎻🎼🎽🎾🎿🏀🏁🏂🏃🏄🏅🏆🏇🏈🏉🏊🏋🏌🏍🏎🏏🏐🏑🏒🏓🏔🏕🏖🏗🏘🏙🏚🏛🏜🏝🏞🏟🏠🏡🏢🏣🏤🏥🏦🏧🏨🏩🏪🏫🏬🏭🏮🏯🏰🏱🏲🏳🏴🏵🏶🏷🏸🏹🏺🏻🏼🏽🏾🏿]/g, '') // 이모지 제거
        .replace(/[🔴🟠🟡🟢🔵🟣⚫⚪🟤🔺🔻🔸🔹🔶🔷🔳🔲▪️▫️◾◽◼️◻️🟥🟧🟨🟩🟦🟪⬛⬜🟫]/g, '') // 색상 이모지 제거
        .replace(/[📱📲📳📴📵📶📷📸📹📺📻📼📽📾📿🔀🔁🔂🔄🔃⏩⏪⏫⏬⏭⏮⏯⏰⏱⏲⏳⏸⏹⏺⏻]/g, '') // 기타 이모지 제거
        .replace(/[💻💼💽💾💿📀📁📂📃📄📅📆📇📈📉📊📋📌📍📎📏📐📑📒📓📔📕📖📗📘📙📚📛📜📝📞📟📠📡📢📣📤📥📦📧📨📩📪📫📬📭📮📯📰📱📲📳📴📵📶📷📸📹📺📻📼📽📾📿]/g, '') // 더 많은 이모지 제거
        .replace(/[😀😃😄😁😆😅😂🤣😊😇🙂🙃😉😌😍🥰😘😗😙😚😋😛😝😜🤪🤨🧐🤓😎🤩🥳😏😒😞😔😟😕🙁☹️😣😖😫😩🥺😢😭😤😠😡🤬🤯😳🥵🥶😱😨😰😥😓🤗🤔🤭🤫🤥😶😐😑😯😦😧😮😲🥱😴🤤😪😵🤐🥴🤢🤮🤧😷🤒🤕🤑🤠]/g, '') // 감정 이모지 제거
        .replace(/[👋🤚🖐️✋🖖👌🤌🤏✌️🤞🤟🤘🤙👈👉👆🖕👇☝️👍👎✊👊👋👌✌️🤞🤟🤘🤙👈👉👆🖕👇☝️👍👎✊👊]/g, '') // 손 이모지 제거
        .replace(/[👶👧🧒👦👩🧑👨👵🧓👴👲👳🧕👮🕵️👷👸🤴👳👲🧕👮🕵️👷👸🤴]/g, '') // 사람 이모지 제거
        .replace(/[🐶🐱🐭🐹🐰🦊🐻🐼🐻‍❄️🐨🐯🦁🐮🐷🐽🐸🐵🙈🙉🙊🐒🐔🐧🐦🐤🐣🐥🦆🦅🦉🦇🐺🐗🐴🦄🐝🐛🦋🐌🐞🐜🦟🦗🕷️🕸️🦂🐢🐍🦎🦖🦕🐙🦑🦐🦞🦀🐡🐠🐟🐬🐳🐋🦈🐊🐅🐆🦓🦍🦧🐘🦛🦏🐪🐫🦙🦒🐃🐂🐄🐎🐖🐏🐑🦌🐕🐩🦮🐕‍🦺🐈🐈‍⬛🐓🦃🦚🦜🦢🦩🕊️🐇🦝🦨🦡🦫🦦🦥🐁🐀🐿️🦔]/g, '') // 동물 이모지 제거
        .replace(/[🌱🌲🌳🌴🌵🌾🌿☘️🍀🍁🍂🍃🍄🍄‍🟫🍅🍆🌶️🌽🥕🥬🥒🥦🧄🧅🥜🌰🥑🥥🥝🥭🍎🍐🍊🍋🍌🍉🍇🍓🫐🍈🍒🍑🥭🍍🥥🥝🍅🍆🥑🥦🥬🥒🌶️🧄🧅🥕🥜🌰🥑🥥🥝🥭🍎🍐🍊🍋🍌🍉🍇🍓🫐🍈🍒🍑🥭🍍🥥🥝🍅🍆🥑🥦🥬🥒🌶️🧄🧅🥕🥜🌰]/g, '') // 식물 이모지 제거
        .replace(/[🍔🍟🍕🌭🥪🌮🌯🥙🧆🥚🍳🧈🥞🧇🥓🥩🍗🍖🦴🌭🍔🍟🍕🥪🥙🧆🌮🌯🥗🥘🥫🍝🍜🍲🍛🍣🍱🥟🦪🍤🍙🍚🍘🍥🥠🥮🍢🍡🍧🍨🍦🥧🧁🍰🎂🍮🍭🍬🍫🍿🍩🍪🌰🥜🍯🥛🍼☕🫖🍵🧃🥤🧋🍶🍺🍻🥂🍷🥃🍸🍹🍾🥄🍴🍽️🥡🥢🧂]/g, '') // 음식 이모지 제거
        .replace(/[⚽🏀🏈⚾🥎🎾🏐🏉🥏🎱🪀🏓🏸🏒🏑🥍🏏🥅⛳🪁🏹🎣🤿🥊🥋🎽🛹🛷⛸️🥌🎿⛷️🏂🪂🏋️‍♀️🏋️‍♂️🤼‍♀️🤼‍♂️🤸‍♀️🤸‍♂️⛹️‍♀️⛹️‍♂️🤺🤾‍♀️🤾‍♂️🏊‍♀️🏊‍♂️🚣‍♀️🚣‍♂️🧗‍♀️🧗‍♂️🚵‍♀️🚵‍♂️🚴‍♀️🚴‍♂️🏆🥇🥈🥉🏅🎖️🏵️🎗️🎫🎟️🎪🤹‍♀️🤹‍♂️🎭🩰🎨🎬🎤🎧🎼🎹🥁🎷🎺🎸🪕🎻🎲♟️🎯🎳🎮🎰🧩🎨📱📲💻⌨️🖥️🖨️🖱️🖲️💽💾💿📀📼📷📸📹📺📻📟📠🔋🔌💡🔦🕯️🪔🧯🛢️💸💵💴💶💷🪙💰💳💎⚖️🪜🪝🔧🔨⚒️🛠️⛏️🪛🔩⚙️🪤🧰🧲🪜🪝🔧🔨⚒️🛠️⛏️🪛🔩⚙️🪤🧰🧲]/g, '') // 스포츠/기타 이모지 제거
        .replace(/[🚗🚕🚙🚌🚎🏎️🚓🚑🚒🚐🛻🚚🚛🚜🛺🚔🚍🚘🚖🚡🚠🚟🚃🚋🚞🚝🚄🚅🚈🚂🚆🚇🚊🚉✈️🛫🛬🛩️💺🛰️🚀🛸🚁🛶⛵🚤🛥️🛳️⛴️🚢⚓🪝⛽🚧🚨🚥🚦🛑🚏🗺️🗿🗽🗼🏰🏯🏟️🎡🎢🎠⛲⛱️🏖️🏝️🏔️⛰️🌋🗻🏕️⛺🏠🏡🏘️🏚️🏗️🏭🏢🏬🏣🏤🏥🏦🏨🏪🏫🏩💒🏛️⛪🕌🕍🛕🕋⛩️🪔🎇🎆🧨✨🎈🎉🎊🎋🎍🎎🎏🎐🎀🎁🪄🪅🎊🎉🎈✨🧨🎆🎇🪔⛩️🕋🛕🕍🕌⛪🏛️💒🏩🏫🏪🏨🏦🏥🏤🏣🏬🏢🏭🏗️🏚️🏘️🏡🏠⛺🏕️🗻🌋⛰️🏔️🏝️🏖️⛱️⛲🎠🎢🎡🏟️🏯🏰🗼🗽🗿🗺️🚏🛑🚦🚥🚨🚧⛽🪝⚓🚢⛴️🛳️🛥️🚤⛵🛶🚁🛸🚀🛰️💺🛩️🛬🛫✈️🚊🚇🚆🚂🚈🚅🚄🚝🚞🚋🚃🚟🚠🚡🚖🚘🚍🚔🛺🚜🚛🚚🛻🚐🚒🚑🚓🏎️🚎🚌🚙🚕🚗]/g, '') // 교통/건물 이모지 제거
        .replace(/[🌍🌎🌏🌐🗺️🗾🧭🏔️⛰️🌋🗻🏕️⛺🏠🏡🏘️🏚️🏗️🏭🏢🏬🏣🏤🏥🏦🏨🏪🏫🏩💒🏛️⛪🕌🕍🛕🕋⛩️🪔🎇🎆🧨✨🎈🎉🎊🎋🎍🎎🎏🎐🎀🎁🪄🪅🎊🎉🎈✨🧨🎆🎇🪔⛩️🕋🛕🕍🕌⛪🏛️💒🏩🏫🏪🏨🏦🏥🏤🏣🏬🏢🏭🏗️🏚️🏘️🏡🏠⛺🏕️🗻🌋⛰️🏔️🏝️🏖️⛱️⛲🎠🎢🎡🏟️🏯🏰🗼🗽🗿🗺️🚏🛑🚦🚥🚨🚧⛽🪝⚓🚢⛴️🛳️🛥️🚤⛵🛶🚁🛸🚀🛰️💺🛩️🛬🛫✈️🚊🚇🚆🚂🚈🚅🚄🚝🚞🚋🚃🚟🚠🚡🚖🚘🚍🚔🛺🚜🚛🚚🛻🚐🚒🚑🚓🏎️🚎🚌🚙🚕🚗]/g, '') // 지리/건물 이모지 제거
        .replace(/[🌍🌎🌏🌐🗺️🗾🧭🏔️⛰️🌋🗻🏕️⛺🏠🏡🏘️🏚️🏗️🏭🏢🏬🏣🏤🏥🏦🏨🏪🏫🏩💒🏛️⛪🕌🕍🛕🕋⛩️🪔🎇🎆🧨✨🎈🎉🎊🎋🎍🎎🎏🎐🎀🎁🪄🪅🎊🎉🎈✨🧨🎆🎇🪔⛩️🕋🛕🕍🕌⛪🏛️💒🏩🏫🏪🏨🏦🏥🏤🏣🏬🏢🏭🏗️🏚️🏘️🏡🏠⛺🏕️🗻🌋⛰️🏔️🏝️🏖️⛱️⛲🎠🎢🎡🏟️🏯🏰🗼🗽🗿🗺️🚏🛑🚦🚥🚨🚧⛽🪝⚓🚢⛴️🛳️🛥️🚤⛵🛶🚁🛸🚀🛰️💺🛩️🛬🛫✈️🚊🚇🚆🚂🚈🚅🚄🚝🚞🚋🚃🚟🚠🚡🚖🚘🚍🚔🛺🚜🚛🚚🛻🚐🚒🚑🚓🏎️🚎🚌🚙🚕🚗]/g, '') // 더 많은 이모지 제거
        .replace(/[🌍🌎🌏🌐🗺️🗾🧭🏔️⛰️🌋🗻🏕️⛺🏠🏡🏘️🏚️🏗️🏭🏢🏬🏣🏤🏥🏦🏨🏪🏫🏩💒🏛️⛪🕌🕍🛕🕋⛩️🪔🎇🎆🧨✨🎈🎉🎊🎋🎍🎎🎏🎐🎀🎁🪄🪅🎊🎉🎈✨🧨🎆🎇🪔⛩️🕋🛕🕍🕌⛪🏛️💒🏩🏫🏪🏨🏦🏥🏤🏣🏬🏢🏭🏗️🏚️🏘️🏡🏠⛺🏕️🗻🌋⛰️🏔️🏝️🏖️⛱️⛲🎠🎢🎡🏟️🏯🏰🗼🗽🗿🗺️🚏🛑🚦🚥🚨🚧⛽🪝⚓🚢⛴️🛳️🛥️🚤⛵🛶🚁🛸🚀🛰️💺🛩️🛬🛫✈️🚊🚇🚆🚂🚈🚅🚄🚝🚞🚋🚃🚟🚠🚡🚖🚘🚍🚔🛺🚜🚛🚚🛻🚐🚒🚑🚓🏎️🚎🚌🚙🚕🚗]/g, ''); // 최종 이모지 제거
    
    // 3. 시스템 메시지나 특수 패턴 제거 (강화된 버전)
    cleanText = cleanText
        // 기본 시스템 메시지 제거
        .replace(/^(시스템|System|ERROR|Error|error|WARNING|Warning|warning|INFO|Info|info|DEBUG|Debug|debug|LOG|Log|log):/g, '')
        .replace(/^\[.*?\]/g, '') // 대괄호로 둘러싸인 시스템 메시지 제거
        .replace(/^\{.*?\}/g, '') // 중괄호로 둘러싸인 시스템 메시지 제거
        .replace(/^<.*?>/g, '') // 꺾쇠괄호로 둘러싸인 시스템 메시지 제거
        .replace(/^\(.*?\)/g, '') // 괄호로 둘러싸인 시스템 메시지 제거
        
        // HTTP/API 관련 시스템 메시지 제거
        .replace(/^HTTP.*?OK.*?$/gm, '') // HTTP 응답 메시지 제거
        .replace(/^INFO:httpx:.*?$/gm, '') // httpx 로그 제거
        .replace(/^✅.*?$/gm, '') // 체크마크 시스템 메시지 제거
        .replace(/^🤖.*?$/gm, '') // 로봇 이모지 시스템 메시지 제거
        .replace(/^🔄.*?$/gm, '') // 리프레시 이모지 시스템 메시지 제거
        .replace(/^🔍.*?$/gm, '') // 돋보기 이모지 시스템 메시지 제거
        .replace(/^📊.*?$/gm, '') // 차트 이모지 시스템 메시지 제거
        
        // AI 응답 관련 시스템 메시지 제거
        .replace(/^\[AI_RESPONSE\].*?$/gm, '') // AI 응답 로그 제거
        .replace(/^\[SEND_MESSAGE\].*?$/gm, '') // 메시지 전송 로그 제거
        .replace(/^\[SAVE_MESSAGE\].*?$/gm, '') // 메시지 저장 로그 제거
        .replace(/^OpenAI.*?응답.*?$/gm, '') // OpenAI 응답 로그 제거
        
        // 랜드마크 관련 시스템 메시지 제거
        .replace(/^랜드마크.*?프레임.*?$/gm, '') // 랜드마크 배치 로그 제거
        .replace(/^📊.*?랜드마크.*?$/gm, '') // 랜드마크 차트 로그 제거
        
        // URL 및 도메인 제거
        .replace(/https?:\/\/[^\s]+/g, '') // HTTP/HTTPS URL 제거
        .replace(/www\.[^\s]+/g, '') // www 도메인 제거
        .replace(/[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '') // 일반 도메인 제거
        .replace(/\/\/[^\s]+/g, '') // //로 시작하는 경로 제거
        
        // JSON 객체 및 딕셔너리 제거
        .replace(/\{[^}]*\}/g, '') // 중괄호로 둘러싸인 JSON 객체 제거
        .replace(/\[[^\]]*\]/g, '') // 대괄호로 둘러싸인 배열 제거
        .replace(/"[^"]*":\s*"[^"]*"/g, '') // JSON 키-값 쌍 제거
        .replace(/"[^"]*":\s*[^,}\]]+/g, '') // JSON 키-값 쌍 제거 (값이 문자열이 아닌 경우)
        
        // 기타 시스템 키워드 제거
        .replace(/^[A-Z_]+:/g, '') // 대문자로 된 시스템 키워드 제거
        .replace(/^[a-z_]+:/g, '') // 소문자로 된 시스템 키워드 제거
        .replace(/^[0-9]+\./g, '') // 숫자로 시작하는 번호 제거
        
        // 특수 문자 번호 제거
        .replace(/^[①②③④⑤⑥⑦⑧⑨⑩]/g, '') // 원문자 번호 제거
        .replace(/^[❶❷❸❹❺❻❼❽❾❿]/g, '') // 원문자 번호 제거
        .replace(/^[⑴⑵⑶⑷⑸⑹⑺⑻⑼⑽]/g, '') // 괄호 숫자 제거
        .replace(/^[㈠㈡㈢㈣㈤㈥㈦㈧㈨㈩]/g, '') // 괄호 한자 제거
        .replace(/^[㉠㉡㉢㉣㉤㉥㉦㉧㉨㉩]/g, '') // 원문자 한자 제거
        .replace(/^[㊀㊁㊂㊃㊄㊅㊆㊇㊈㊉]/g, '') // 원문자 한자 제거
        .replace(/^[㊐㊑㊒㊓㊔㊕㊖㊗㊘㊙]/g, '') // 원문자 한자 제거
        .replace(/^[㊚㊛㊜㊝㊞㊟㊠㊡㊢㊣]/g, '') // 원문자 한자 제거
        .replace(/^[㊤㊥㊦㊧㊨㊩㊪㊫㊬㊭]/g, '') // 원문자 한자 제거
        .replace(/^[㊮㊯㊰㊱㊲㊳㊴㊵㊶㊷]/g, '') // 원문자 한자 제거
        .replace(/^[㊸㊹㊺㊻㊼㊽㊾㊿]/g, ''); // 원문자 한자 제거
    
    // 4. 불필요한 공백 정리
    cleanText = cleanText
        .replace(/\s+/g, ' ') // 연속된 공백을 하나로
        .replace(/^\s+|\s+$/g, '') // 앞뒤 공백 제거
        .replace(/^[,\s]+|[,\s]+$/g, '') // 앞뒤 쉼표와 공백 제거
        .replace(/^[.\s]+|[.\s]+$/g, ''); // 앞뒤 점과 공백 제거
    
    // 5. 빈 텍스트 체크
    if (!cleanText || cleanText.trim().length === 0) {
        console.warn('[TTS] 정리 후 텍스트가 비어있음');
        return null;
    }
    
    // 6. 최종 길이 체크 (너무 긴 텍스트는 자르기)
    if (cleanText.length > 500) {
        console.warn('[TTS] 텍스트가 너무 김, 자름:', cleanText.length);
        cleanText = cleanText.substring(0, 500) + '...';
    }
    
    console.log('[TTS] 정리된 텍스트:', cleanText);
    return cleanText;
}

/**
 * TTS로 AI 응답 읽어주기
 * @param {string} aiResponse - AI 응답 텍스트
 */
function speakAIResponse(aiResponse) {
    if (window.ttsManager && window.ttsManager.isEnabled) {
        if (aiResponse && aiResponse.trim()) {
            console.log('[TTS] 원본 AI 응답:', aiResponse);
            const cleanText = cleanTextForTTS(aiResponse);
            
            if (cleanText && cleanText.trim()) {
                console.log('[TTS] 정리된 텍스트로 TTS 호출:', cleanText);
                window.ttsManager.speak(cleanText);
            } else {
                console.warn('[TTS] 정리 후 텍스트가 비어있어 TTS 호출하지 않음');
            }
        }
    }
}

/**
 * TTS 관리자 정리
 */
function cleanupTTSManager() {
    if (window.ttsManager) {
        try {
            console.log('[CLEANUP] TTS 관리자 정리 중...');
            window.ttsManager.cleanup();
            window.ttsManager = null;
            console.log('[CLEANUP] TTS 관리자 정리 완료');
        } catch (e) {
            console.warn('[CLEANUP] TTS 정리 실패:', e);
        }
    }
}

// 전역 함수로 노출
window.cleanTextForTTS = cleanTextForTTS;
window.speakAIResponse = speakAIResponse;
window.cleanupTTSManager = cleanupTTSManager;
