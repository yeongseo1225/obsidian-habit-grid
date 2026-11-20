import { setIcon } from "obsidian";
import { tr } from "./i18n";

// 이전·다음 버튼의 글자 화살표(‹ ›)를 같은 굵기의 아이콘 화살표로 바꾼다
export function iconifyNav(root) {
  for (const b of root.querySelectorAll(".hg-yearbtn")) {
    const t = b.textContent.trim();
    if (t !== "‹" && t !== "›") continue;
    b.empty();
    setIcon(b, t === "‹" ? "chevron-left" : "chevron-right");
  }
}

// 카드 오른쪽 위 '⋯' 메뉴 버튼
export function addMoreButton(head, opts) {
  if (!opts.onMore) return;
  const right = head.createDiv({ cls: "hg-headright" });
  const kids = [...head.children].filter((c) => c !== right && !c.classList.contains("hg-title"));
  for (const k of kids) right.appendChild(k);
  const more = right.createSpan({ cls: "hg-more", text: "⋯" });
  more.setAttr("aria-label", tr("더 보기"));
  more.addEventListener("click", (evt) => opts.onMore(evt));
  stopEditorGrab(more);
}

export function makeColorDot(dot, opts) {
  if (!opts.onColor) return;
  dot.addClass("is-clickable");
  dot.setAttr("aria-label", tr("색 바꾸기"));
  dot.addEventListener("click", (evt) => { evt.stopPropagation(); opts.onColor(evt); });
  stopEditorGrab(dot);
}

// 라이브 프리뷰에서 클릭이 편집기로 넘어가 코드 블록이 열리지 않게 막는다
export function stopEditorGrab(el) {
  el.addEventListener("mousedown", (e) => e.stopPropagation());
}

// PC에서 마우스 휠(세로)과 드래그로 가로 스크롤
export function enableHorizontalScroll(scroll) {
  scroll.addEventListener("wheel", (e) => {
    const max = scroll.scrollWidth - scroll.clientWidth;
    if (max <= 0 || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
    if ((e.deltaY < 0 && scroll.scrollLeft <= 0) || (e.deltaY > 0 && scroll.scrollLeft >= max - 1)) return;
    e.preventDefault();
    scroll.scrollLeft += e.deltaY;
  }, { passive: false });

  let drag = null;
  scroll.addEventListener("pointerdown", (e) => {
    if (e.pointerType !== "mouse" || e.button !== 0 || scroll.scrollWidth <= scroll.clientWidth) return;
    drag = { x: e.clientX, left: scroll.scrollLeft, moved: false, id: e.pointerId };
  });
  scroll.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    if (!drag.moved && Math.abs(dx) > 4) {
      drag.moved = true;
      scroll.addClass ? scroll.addClass("is-dragging") : scroll.classList.add("is-dragging");
      try { scroll.setPointerCapture(drag.id); } catch (_) { /* pointer already released */ }
    }
    if (drag.moved) scroll.scrollLeft = drag.left - dx;
  });
  const end = () => {
    if (!drag) return;
    const moved = drag.moved;
    scroll.classList.remove("is-dragging");
    window.setTimeout(() => { if (drag && drag.moved === moved) drag = null; }, 0);
    if (!moved) drag = null;
  };
  scroll.addEventListener("pointerup", end);
  scroll.addEventListener("pointercancel", () => { drag = null; scroll.classList.remove("is-dragging"); });
  scroll.addEventListener("click", (e) => {
    if (drag && drag.moved) { e.stopPropagation(); e.preventDefault(); }
    drag = null;
  }, true);
}
