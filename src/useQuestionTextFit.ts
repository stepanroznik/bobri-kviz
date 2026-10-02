import { onBeforeUnmount, onMounted, watch, type Ref } from 'vue';
import type { Slide } from './types';

/** Keeps the normal font unless the question overflows; never shrinks it by more than 6%. */
export function useQuestionTextFit(
  body: Ref<HTMLElement | null>,
  text: Ref<HTMLElement | null>,
  slide: Readonly<Ref<Slide>>,
): () => void {
  let observer: ResizeObserver | null = null;
  let frame = 0;
  let mounted = false;

  function fit(): void {
    const container = body.value;
    const prompt = text.value;
    if (!container || !prompt) return;

    // Start from the stylesheet on every slide/resize so small questions never inherit a shrink.
    prompt.style.removeProperty('font-size');
    const containerStyle = getComputedStyle(container);
    const promptStyle = getComputedStyle(prompt);
    const baseFontSize = parseFloat(promptStyle.fontSize);
    let availableHeight = container.clientHeight
      - parseFloat(containerStyle.paddingTop) - parseFloat(containerStyle.paddingBottom)
      - parseFloat(promptStyle.marginTop) - parseFloat(promptStyle.marginBottom);

    for (const sibling of Array.from(container.children)) {
      if (!(sibling instanceof HTMLElement) || sibling === prompt) continue;
      const style = getComputedStyle(sibling);
      if (style.position === 'absolute' || style.position === 'fixed' || style.display === 'none') continue;
      availableHeight -= sibling.getBoundingClientRect().height
        + parseFloat(style.marginTop) + parseFloat(style.marginBottom);
    }

    const fits = (): boolean => prompt.getBoundingClientRect().height <= availableHeight + 1;
    if (fits()) return;
    for (let step = 1; step <= 12; step += 1) {
      prompt.style.fontSize = `${baseFontSize * (1 - step * 0.005)}px`;
      if (fits()) break;
    }
  }

  function scheduleFit(): void {
    if (!mounted || frame) return;
    frame = requestAnimationFrame(() => { frame = 0; fit(); });
  }

  watch(body, (element, previous) => {
    if (previous) observer?.unobserve(previous);
    if (element) observer?.observe(element);
    scheduleFit();
  }, { flush: 'post' });
  watch([slide, text], scheduleFit, { flush: 'post' });

  onMounted(() => {
    mounted = true;
    observer = new ResizeObserver(scheduleFit);
    if (body.value) observer.observe(body.value);
    document.fonts.addEventListener('loadingdone', scheduleFit);
    void document.fonts.ready.then(scheduleFit);
    scheduleFit();
  });
  onBeforeUnmount(() => {
    mounted = false;
    observer?.disconnect();
    document.fonts.removeEventListener('loadingdone', scheduleFit);
    if (frame) cancelAnimationFrame(frame);
  });

  return scheduleFit;
}
