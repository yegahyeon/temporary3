/* =========================================================
   썸비 랜딩페이지 인터랙션
   ========================================================= */



document.addEventListener('DOMContentLoaded', () => {
  /* ---------- GSAP 공통: 이미지가 늦게 로드되어 레이아웃이 바뀌면 트리거 위치가 어긋나므로,
     전체 리소스(이미지 등)가 다 로드된 뒤 트리거 위치를 다시 계산한다.
     (이게 없으면 pin/애니메이션이 실제 스크롤 위치와 어긋나 "늦게 나온다"거나 "안 먹힌다"고 느껴짐) */
  if (window.ScrollTrigger) {
    window.addEventListener('load', () => ScrollTrigger.refresh());
  }

  const gnb = document.querySelector(".hero-nav");
  document.addEventListener("scroll", () => {
    const scrollT = window.scrollY;
    if (scrollT !== 0) {
      gnb.classList.add("down");
    } else {
      gnb.classList.remove("down");
    }
  });

  /* ---------- GSAP: 지갑 위 동전이 quote__path를 따라 움직이다 제자리에서 두 번 튀며 착지 ----------
     #quote__path는 <svg id="quote__path"><path d="..."/></svg> 구조라서,
     MotionPathPlugin에는 svg가 아니라 그 안의 실제 <path> 요소를 넘겨줘야 경로를 읽는다. */
  if (window.gsap && window.MotionPathPlugin && window.ScrollTrigger && window.SplitText) {
    gsap.registerPlugin(MotionPathPlugin, ScrollTrigger, SplitText);

    const coinEl = document.querySelector('#quote__coin');
    const pathEl = document.querySelector('#quote__path path');

    if (coinEl && pathEl) {
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      if (reduceMotion) {
        gsap.set(coinEl, { opacity: 1 });
      } else {
        const coinTl = gsap.timeline({
          scrollTrigger: {
            trigger: coinEl,
            start: 'top 85%',
            once: true,
          },
        });

        /* 관성 낙하/바운스 오프셋은 원래 데스크톱 지갑 크기(~800px) 기준의 고정 px 라서,
           모바일처럼 지갑(.quote__visual)이 작아지면 코인이 상대적으로 너무 멀리 떨어짐.
           지갑 실제 폭에 비례해 오프셋을 축소(데스크톱은 k≈1 로 사실상 동일). */
        const _qv = document.querySelector('.quote__visual');
        const _vw = _qv ? _qv.getBoundingClientRect().width : 800;
        const k = Math.min(1, _vw / 800);

        coinTl
          .set(coinEl, { opacity: 1, })
          .to(coinEl, {
            motionPath: {
              path: pathEl,
              align: pathEl,
              alignOrigin: [0.5, 0.5],
              autoRotate: true,
            },
            duration: 1.3,
            ease: 'power2.inOut',
          })
          /* path 끝에서 딱 멈추지 않고, 관성으로 오른쪽 아래로 더 떨어지는 구간(진짜 떨어지는 느낌) */
          .to(coinEl, { x: '+=' + (80 * k), y: '+=' + (48 * k), rotation: '+=25', duration: 0.32, ease: 'power1.in' })

          /* 착지 후 두 번 통통 튀는 바운스 */
          .to(coinEl, { y: '-=' + (20 * k), duration: 0.18, ease: 'power1.out' })
          .to(coinEl, { y: '+=' + (20 * k), duration: 0.22, ease: 'bounce.out' })
          .to(coinEl, { y: '-=' + (6 * k), duration: 0.14, ease: 'power1.out' })
          .to(coinEl, { y: '+=' + (6 * k), duration: 0.18, ease: 'bounce.out' })
          /* 착지 후 은은하게 계속 둥실거리는 유휴 모션 */
          .to(coinEl, { y: '-=' + (8 * k), duration: 1.2, ease: 'sine.inOut', repeat: -1, yoyo: true });

      }
    }
  }

  /* ---------- 0-0. 매출의 함정 지출 카드: trap-wrap 고정 + 카드 등장마다 매출 차감 ----------
     pin: '.trap-wrap'으로 상단 매출 카드 영역을 화면에 고정해 둔 채로 스크롤을 계속하면
     지출 카드가 한 장씩 등장하고, 등장할 때마다 그 카드의 지출액(epv)만큼 매출 카드의
     숫자가 깎여나간다. 모든 카드가 다 등장하면 trap 문구는 사라지고 매출 카드는
     (이미 깎여서 남은 값 그대로) 순이익 카드(.profit-wrap) 모습으로 자연스럽게 바뀐다. */
  const trapWrap = document.querySelector('.trap-wrap');
  const trapIntro = document.querySelector('.trap-intro');
  const trapSub = document.querySelector('.trap-sub');
  const trapArrow = document.querySelector('.trap-arrow');
  const salesCard = document.querySelector('.sales-card');
  const salesValueEl = salesCard ? salesCard.querySelector('p.value') : null;
  const salesLabelEl = salesCard ? salesCard.querySelector('p.label') : null;
  /* 매출 카드가 순이익 카드로 바뀔 때 상단 오른쪽에 함께 나타날 마진율 배지 */
  const salesBadge = salesCard ? salesCard.querySelector('.margin-badge') : null;

  /* "-1,200만원" -> 1200 (부호/콤마/단위 등 숫자가 아닌 문자는 모두 제거) */
  const digitsOf = (str) => parseInt((str.match(/\d/g) || []).join(''), 10) || 0;
  const formatWon = (num) => `${num.toLocaleString('ko-KR')}￦`;
  /* 카드의 p > b 텍스트("-1,200만원")에서 숫자만 뽑아 뒤에 0000을 붙여 '만원' 단위를 '원' 단위로 환산 */
  const getEpv = (card) => {
    const bEl = card.querySelector('p > b');
    if (!bEl) return 0;
    return parseInt(`${digitsOf(bEl.textContent)}0000`, 10);
  };

  const cards = gsap.utils.toArray('.expense-card');
  const initialSalesValue = salesValueEl ? digitsOf(salesValueEl.textContent) : 0;
  let salesValue = initialSalesValue;

  if (cards.length && window.gsap && window.ScrollTrigger) {
    const reduceMotionCards = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduceMotionCards) {
      gsap.set(cards, { opacity: 1, y: 0 });
      cards.forEach((card) => { salesValue -= getEpv(card); });
      if (salesValueEl) salesValueEl.textContent = formatWon(salesValue);
      if (salesLabelEl) salesLabelEl.textContent = '실제 남는 수익';
      gsap.set([trapIntro, trapSub, trapArrow], { opacity: 0 });
      if (salesCard) gsap.set(salesCard, { backgroundColor: '#000' });
      if (salesBadge) {
        const badgeValueEl = salesBadge.querySelector('.value');
        if (badgeValueEl) {
          const ratio = initialSalesValue ? (salesValue / initialSalesValue) * 100 : 0;
          badgeValueEl.textContent = `${ratio.toFixed(2)}%`;
        }
        gsap.set(salesBadge, { opacity: 1, scale: 1 });
      }
    } else {
      gsap.set(cards, { opacity: 0, y: 60 });
      if (salesBadge) gsap.set(salesBadge, { opacity: 0, scale: 0.6 });

      /* 모바일에서만 end를 sec-trap 섹션 끝(bottom bottom)에 맞춤 -> pin 해제 지점이 섹션 경계와 일치.
         PC는 기존 카드 개수 기반 픽셀 값을 그대로 사용(변경 없음). */
      const isMobileTrap = window.matchMedia('(max-width: 768px)').matches;

      const cardsTl = gsap.timeline({
        scrollTrigger: {
          trigger: '.expense-grid',
          start: 'top 90%',
          ...(isMobileTrap
            ? { endTrigger: '.sec-trap', end: 'bottom 70%' }
            : { end: `+=${cards.length * 200 + 400}` }),
          scrub: true,
          pin: trapWrap,
          pinReparent: true,
          anticipatePin: 1,
          snap: 1 / 6,
        },
      });

      cards.forEach((card) => {
        const epv = getEpv(card);

        cardsTl.to(card, {
          opacity: 0.7,
          y: 0,
          duration: 2,
          onStart: () => {
            salesValue -= epv;
            if (salesValueEl) salesValueEl.textContent = formatWon(salesValue);
          },
          onReverseComplete: () => {
            salesValue += epv;
            if (salesValueEl) salesValueEl.textContent = formatWon(salesValue);
          },
        });
      });

      /* 모든 카드 등장이 끝난 뒤: trap 문구는 사라지고, 매출 카드는 순이익 카드 스타일로 전환 */
      cardsTl
        .to([trapIntro, trapSub, trapArrow], { opacity: 0, y: -20, duration: 1.2 }, '+=0.2')
        .to(salesCard, { backgroundColor: '#000', duration: 1.2 }, '<')
        .call(() => {
          if (salesLabelEl) salesLabelEl.textContent = '실제 남는 수익';
          if (salesBadge) {
            const badgeValueEl = salesBadge.querySelector('.value');
            if (badgeValueEl) {
              const ratio = initialSalesValue ? (salesValue / initialSalesValue) * 100 : 0;
              badgeValueEl.textContent = `${ratio.toFixed(2)}%`;
            }
          }
        }, null, '<0.6');

      /* 애니메이션이 거의 끝날 무렵 마진율 배지가 sales-card 우측 상단에 톡 튀어나오듯 등장 */
      if (salesBadge) {
        cardsTl.to(salesBadge, { opacity: 1, scale: 1, duration: 1, ease: 'back.out(1.7)' }, '<0.2');
      }
    }
  }

  // 말풍선 gsap

  gsap.from(".bubble", {
    scrollTrigger: {
      trigger: ".worry",
      start: "50% bottom",
      end: "bottom 50%",
      scrub: true,
    },
    opacity: 0,
    y: -50,
    stagger: 0.3
  });

  /* ---------- 0-1. 전체 섹션 공통 스크롤 등장(텍스트/요소 기본 리빌) ----------
  hero는 자체 인트로가 있어 제외. 각 섹션의 .inner 바로 아래 자식(제목, 문단, 카드 묶음, 이미지 등)을
  리빌 대상으로 삼아, 화면에 들어오는 시점에 아래→위로 살짝 fade-up.
  동전(#quote__coin)의 모션패스 스크롤 트리거와는 별개의 트리거로 독립 동작. */


  if (window.gsap && window.ScrollTrigger) {

    const revealTargets = gsap.utils.toArray(
      'section:not(.sec-hero, .worry) .inner > *:not(.expense-grid)'
    );
    const reduceMotionReveal = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    

    if (reduceMotionReveal) {
      gsap.set(revealTargets, { opacity: 1, y: 0 });
    } else {
      revealTargets.forEach((el) => {
        gsap.fromTo(
          el,
          { opacity: 0, y: 32 },
          {
            opacity: 1,
            y: 0,
            duration: 0.7,
            ease: 'power2.out',
            scrub: true,
            scrollTrigger: {
              trigger: el,
              start: 'top 75%',
            },
          }
        );
      });
    }
  }


  /* ---------- 수익 구조 다이어그램: 막대가 아래에서부터 자라난 뒤,
     값 레이블과 마진율 배지가 순서대로 팝인 ---------- */
  const diagramEl = document.querySelector('.structure-diagram');
  if (diagramEl && window.gsap && window.ScrollTrigger) {
    const diagramBars = gsap.utils.toArray('.diagram-bar', diagramEl);
    const diagramValues = gsap.utils.toArray('.diagram-value', diagramEl);
    const diagramBadges = gsap.utils.toArray('.diagram-badge', diagramEl);
    const reduceMotionDiagram = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduceMotionDiagram) {
      gsap.set(diagramBars, { scaleY: 1 });
      gsap.set(diagramValues, { opacity: 1 });
      gsap.set(diagramBadges, { opacity: 1, scale: 1 });
    } else {
      gsap.set(diagramBars, { scaleY: 0 });
      gsap.set(diagramValues, { opacity: 0 });
      gsap.set(diagramBadges, { opacity: 0, scale: 0.6 });

      const diagramTl = gsap.timeline({
        scrollTrigger: { trigger: diagramEl, start: 'top 75%', once: true },
      });

      diagramTl
        .to(diagramBars, { scaleY: 1, duration: 0.8, ease: 'power3.out', stagger: 0.12 })
        .to(diagramValues, { opacity: 1, duration: 0.35, ease: 'power2.out', stagger: 0.1 }, '-=0.55')
        .to(diagramBadges, { opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(2)', stagger: 0.15 }, '-=0.25');
    }
  }

  /* ---------- 돈이 남는 구조 배너: 글자 단위로 튀어 오르며 등장 ----------
     .banner-main .hl 텍스트만 글자 단위로 쪼개서(SplitText), 배너가 스크롤로
     화면에 들어올 때 한 글자씩 순차적으로 떠오르게 한다. */
  if (window.gsap && window.SplitText) {
    const bannerHl = document.querySelector('.banner-main .hl');
    const reduceMotionBanner = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (bannerHl) {
      if (reduceMotionBanner) {
        gsap.set(bannerHl, { autoAlpha: 1 });
      } else {
        const split = SplitText.create(bannerHl, { type: 'chars' });


        gsap.from(".banner-main", {
          duration: 0.5,
          y:-50,
          opacity: 0,
          scrollTrigger: {
            trigger: bannerHl,
            start: 'top 85%',
            
          }

        })
        gsap.from(split.chars, {
          duration: 0.4,
          y: 100,
          autoAlpha: 0,
          stagger: 0.05,
          scrollTrigger: {
            trigger: bannerHl,
            start: 'top 85%',
            once: true,
          },
        });
      }
    }
  }

  /* ---------- 마무리 카피 "돈 버는 가게": 도장을 꽝 찍듯 등장 ----------
     위쪽에서 비스듬히 크게 내려와 순간적으로 부딪히듯 멈추고, 찍힌 충격으로
     눌렸다 튕겨 나왔다가 제자리에 안착하는 도장 임팩트를 준다. */
  const stampEl = document.querySelector('.t-em.f-griun');
  if (stampEl && window.gsap && window.ScrollTrigger) {
    const reduceMotionStamp = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduceMotionStamp) {
      gsap.set(stampEl, { opacity: 1, scale: 1, rotate: 0, y: 0, x: 0 });
    } else {
      const stampTl = gsap.timeline({
        scrollTrigger: {
          trigger: stampEl,
          start: 'top 85%',
          once: true,
        },
      });

      stampTl
        /* 비스듬히 커다랗게 위에서 빠르게 내려와 꽝 찍힘 */
        .fromTo(
          stampEl,
          { opacity: 0, scale: 2.4, rotate: -10, y: -60 },
          { opacity: 1, scale: 1.15, rotate: 0, y: 0, duration: 0.22, ease: 'power4.in' }
        )
        /* 충격으로 눌렸다 튕겨 나왔다가 제자리에 안착 */
        .to(stampEl, { scale: 0.9, x: -4, duration: 0.08, ease: 'power1.out' })
        .to(stampEl, { scale: 1.05, x: 4, duration: 0.1, ease: 'power1.out' })
        .to(stampEl, { scale: 1, x: 0, duration: 0.12, ease: 'power1.inOut' });
    }
  }

  /* ---------- 창업 비용 표: 탭(브랜드전환/업종변경/신규창업)별 값 ----------
     라벨/비고 칸은 탭이 바뀌어도 그대로 두고, cost-cell--value만 갈아끼운다.
     탭별 실제 금액은 아래 COST_TABLE_DATA만 고치면 된다 — 각 행의 key는
     index.html의 해당 .cost-cell--value에 붙은 data-row 값과 대응된다.
     가맹비처럼 "면제" 연출(취소선 + 스티커)이 필요한 행은 값을 문자열 대신
     { value, waived } 객체로 적으면 된다. */
  const COST_TABLE_DATA = {
    brand: {
      title: '브랜드 전환',
      note: '단위:원 / VAT 별도. 점포 상태별 변동 가능.',
      rows: {
        header: '브랜드전환',
        franchiseFee: { value: '3,000,000', waived: '0원' },
        eduFee: '5,000,000',
        deposit: '보증보험<br />가능',
        interior: '자율',
        signage: '3,000,000',
        furniture: '자율',
        facility: '자율',
        marketing: '자율',
        initialGoods: '2,000,000',
        interiorEtc: '',
        total: '10,000,000+@',
      },
    },
    /* TODO: pivot(업종변경)/new(신규창업) 값은 브랜드전환 값을 임시로 복사해둔 것.
       실제 금액이 확정되면 아래 rows만 교체하면 된다. */
    pivot: {
      title: '업종변경',
      note: '단위:원 / VAT 별도. 점포 상태별 변동 가능.',
      rows: {
        header: '업종변경',
        franchiseFee: { value: '3,000,000', waived: '0원' },
        eduFee: '5,000,000',
        deposit: '보증보험<br />가능',
        interior: '15,000,000',
        signage: '3,000,000',
        furniture: '자율',
        facility: '3,000,000',
        marketing: '자율',
        initialGoods: '2,000,000',
        interiorEtc: '',
        total: '28,000,000+@',
      },
    },
    new: {
      title: '신규창업',
      note: '단위:원 / VAT 별도. 점포 상태별 변동 가능.',
      rows: {
        header: '신규창업',
        franchiseFee: { value: '3,000,000', waived: '0원' },
        eduFee: '5,000,000',
        deposit: '보증보험<br />가능',
        interior: '45,000,00',
        signage: '3,000,000',
        furniture: '6,000,000',
        facility: '15,000,000',
        marketing: '자율',
        initialGoods: '2,000,000',
        interiorEtc: '',
        total: '76,000,000+@',
      },
    },
  };

  /* 3,000,000원에 밑줄이 그어지며 흐려지고, 이어서 "0원"이 스티커처럼 착 붙는 연출을
     (재)시작한다. 클래스를 껐다 켜서 CSS 애니메이션을 처음부터 다시 재생시킨다. */
  const playWaivedReveal = (el) => {
    el.classList.remove('is-revealed');
    void el.offsetWidth; /* 리플로우 강제 → 애니메이션 재시작 */
    el.classList.add('is-revealed');
  };

  const renderCostValueCell = (el, data) => {
    if (data && typeof data === 'object' && 'waived' in data) {
      el.classList.add('cost-cell--waived');
      el.innerHTML = `<span class="cost-old">${data.value}</span><em class="f-griun">${data.waived}</em>`;
      playWaivedReveal(el);
    } else {
      el.classList.remove('cost-cell--waived', 'is-revealed');
      el.innerHTML = data || '';
    }
  };

  const costTitleEl = document.querySelector('[data-cost-title]');
  const costNoteEl = document.querySelector('[data-cost-note]');
  const costTabEls = document.querySelectorAll('.cost-tab[data-tab]');
  const costValueEls = document.querySelectorAll('.cost-table .cost-cell--value[data-row]');

  const renderCostTab = (tabKey) => {
    const data = COST_TABLE_DATA[tabKey];
    if (!data) return;
    if (costTitleEl) costTitleEl.textContent = data.title;
    if (costNoteEl) costNoteEl.textContent = data.note;
    costValueEls.forEach((el) => renderCostValueCell(el, data.rows[el.dataset.row]));
  };

  if (costTabEls.length) {
    costTabEls.forEach((tab) => {
      tab.addEventListener('click', () => {
        if (tab.classList.contains('cost-tab--active')) return;
        costTabEls.forEach((t) => t.classList.remove('cost-tab--active'));
        tab.classList.add('cost-tab--active');
        renderCostTab(tab.dataset.tab);
      });
    });
  }

  /* 최초 진입 시(브랜드전환 탭)의 가맹비 면제 연출만은 스크롤로 화면에 들어오는
     시점에 재생한다. 그 이후(탭 전환)의 재생은 playWaivedReveal이 즉시 담당. */
  const costWaivedEl = document.querySelector('.cost-cell--waived');
  if (costWaivedEl) {
    if (window.gsap && window.ScrollTrigger) {
      ScrollTrigger.create({
        trigger: costWaivedEl,
        start: 'top 85%',
        once: true,
        onEnter: () => costWaivedEl.classList.add('is-revealed'),
      });
    } else {
      costWaivedEl.classList.add('is-revealed');
    }
  }

  /* ---------- 1. CTA 버튼 → 상담 폼으로 부드럽게 스크롤 ---------- */
  document.querySelectorAll('.js-cta').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const target = document.querySelector('#inquiry');
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
  });
  
  /* ---------- 2. 연락처 자동 하이픈 포맷 (010-0000-0000) ---------- */
  const phoneInput = document.querySelector('#phone');
  if (phoneInput) {
    phoneInput.addEventListener('input', () => {
      const digits = phoneInput.value.replace(/\D/g, '').slice(0, 11);
      let formatted = digits;
      if (digits.length > 7) {
        formatted = `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
      } else if (digits.length > 3) {
        formatted = `${digits.slice(0, 3)}-${digits.slice(3)}`;
      }
      phoneInput.value = formatted;
    });
  }
  
  /* ---------- 3. 셀렉트 선택 시 글자색 변경 (placeholder 스타일) ---------- */
  const budgetSelect = document.querySelector('#budget');
  if (budgetSelect) {
    budgetSelect.addEventListener('change', () => {
      budgetSelect.classList.toggle('filled', budgetSelect.value !== '');
    });
  }
  
  /* ---------- 4. 상담 신청 폼 검증 및 제출 ---------- */
  const form = document.querySelector('#inquiryForm');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      
      const name = form.name.value.trim();
      const phone = form.phone.value.trim();
      const agree = form.agree.checked;
      
      if (!name) {
        alert('이름을 입력해주세요.');
        form.name.focus();
        return;
      }
      if (!/^01[0-9]-\d{3,4}-\d{4}$/.test(phone)) {
        alert('연락처를 010-0000-0000 형식으로 입력해주세요.');
        form.phone.focus();
        return;
      }
      if (!agree) {
        alert('개인정보 수집 및 이용에 동의해주세요.');
        return;
      }
      
      /* 실제 서비스에서는 아래에 서버 전송 로직(fetch 등)을 연결하세요. */
      alert(`${name}님, 상담 신청이 접수되었습니다.\n담당자가 빠르게 연락드리겠습니다.`);
      form.reset();
      budgetSelect && budgetSelect.classList.remove('filled');
    });
  }
  
  /* ---------- 5. 수익 인증 갤러리 스와이퍼 (profit1~3, 확대 이미지 동기화) ---------- */
  const proofSwiperEl = document.querySelector('.proof-swiper');
  if (proofSwiperEl && window.Swiper) {
    const zoomBox = document.querySelector('.proof-gallery .zoom');
    const zoomImg = document.querySelector('.proof-gallery .zoom-img');
    const proofImages = ['./source/profit1.jpg', './source/profit2.png', './source/profit3.png'];
    
    const playZoomPop = () => {
      if (!zoomBox) return;
      zoomBox.classList.remove('is-zooming');
      void zoomBox.offsetWidth; /* 리플로우 강제 → 애니메이션 재시작 */
      zoomBox.classList.add('is-zooming');
    };
    
    new Swiper(proofSwiperEl, {
      slidesPerView: 3,
      centeredSlides: true,
      spaceBetween: 8,
      loop: true,
      initialSlide: 3,
      navigation: {
        nextEl: '.proof-next',
        prevEl: '.proof-prev',
      },
      on: {
        init(swiper) {
          if (zoomImg) {
            zoomImg.src = proofImages[swiper.realIndex % proofImages.length];
          }
          playZoomPop();
        },
        slideChange(swiper) {
          if (zoomImg) {
            zoomImg.src = proofImages[swiper.realIndex % proofImages.length];
          }
          playZoomPop();
        },
      },
    });
  }
  
  /* ---------- 6. 개인정보 수집 및 이용 안내 ---------- */
  const privacyLink = document.querySelector('.form-agree .underline');
  if (privacyLink) {
    privacyLink.addEventListener('click', (e) => {
      e.preventDefault();
      alert(
        '[개인정보 수집 및 이용 안내]\n\n' +
        '수집 항목: 이름, 연락처, 창업 희망지역, 창업 예산, 문의 내용\n' +
        '수집 목적: 창업 상담 및 안내\n' +
        '보유 기간: 상담 완료 후 1년\n\n' +
        '동의를 거부할 수 있으나, 거부 시 상담 신청이 제한됩니다.'
      );
    });
  }
  
  /* ---------- 7. FAQ 아코디언: 한 번에 하나만 열리도록, 열 때 나머지는 모두 닫는다 ---------- */
  const faqItems = document.querySelectorAll('.faq-item');
  faqItems.forEach((item) => {
    const btn = item.querySelector('.faq-item__q');
    btn.addEventListener('click', () => {
      const willOpen = !item.classList.contains('is-open');
      
      
      
      faqItems.forEach((other) => {
        other.classList.remove('is-open');
        other.querySelector('.faq-item__q').setAttribute('aria-expanded', 'false');
      });
      
      if (willOpen) {
        item.classList.add('is-open');
        btn.setAttribute('aria-expanded', 'true');
      }
    });
  });
  
  /* ---------- 1=8. top 버튼 → 상단으로 부드럽게 스크롤 ---------- */
  document.querySelectorAll('.top').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const target = document.querySelector('#sec-hero');
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
  });
});
