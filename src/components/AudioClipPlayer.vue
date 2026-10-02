<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { audioClipRange } from '../audioClip';

const props = defineProps<{ src: string; start?: number; end?: number }>();
const emit = defineEmits<{ time: [seconds: number]; duration: [seconds: number] }>();
const player = ref<HTMLAudioElement | null>(null);
const duration = ref(Infinity);
const range = computed(() => audioClipRange({ audioStart: props.start, audioEnd: props.end }, duration.value));
let stopTimer: ReturnType<typeof setTimeout> | undefined;

function clearStopTimer(): void { clearTimeout(stopTimer); stopTimer = undefined; }
function scheduleStop(): void {
  clearStopTimer();
  const audio = player.value;
  if (!audio || audio.paused || audio.seeking || !Number.isFinite(range.value.end)) return;
  stopTimer = setTimeout(stopAtEnd, Math.max(0, (range.value.end - audio.currentTime) / audio.playbackRate * 1_000));
}
function stopAtEnd(): void {
  const audio = player.value;
  if (!audio) return;
  audio.pause();
  audio.currentTime = range.value.end;
  clearStopTimer();
}
function reset(): void {
  clearStopTimer();
  const audio = player.value;
  if (!audio) return;
  audio.pause();
  if (audio.readyState >= 1) audio.currentTime = range.value.start;
}
function updateDuration(): void {
  if (!player.value) return;
  duration.value = player.value.duration;
  emit('duration', duration.value);
}
function loaded(): void {
  updateDuration();
  reset();
}
function play(): void {
  const audio = player.value;
  if (!audio) return;
  if (audio.currentTime < range.value.start || audio.currentTime >= range.value.end) audio.currentTime = range.value.start;
  scheduleStop();
}
function timeUpdate(): void {
  const audio = player.value;
  if (!audio) return;
  emit('time', audio.currentTime);
  if (!audio.paused && audio.currentTime >= range.value.end) stopAtEnd();
  else scheduleStop();
}
function seek(): void {
  const audio = player.value;
  if (!audio) return;
  if (audio.currentTime < range.value.start) audio.currentTime = range.value.start;
  else if (audio.currentTime > range.value.end) audio.currentTime = range.value.end;
  if (audio.currentTime >= range.value.end) audio.pause();
  scheduleStop();
}
watch(() => [props.start, props.end], reset);
watch(() => props.src, () => { duration.value = Infinity; reset(); });
onBeforeUnmount(() => { clearStopTimer(); player.value?.pause(); });
</script>

<template>
  <audio ref="player" controls preload="metadata" :src="src" @loadedmetadata="loaded" @durationchange="updateDuration"
    @play="play" @playing="scheduleStop" @waiting="clearStopTimer" @pause="clearStopTimer" @timeupdate="timeUpdate" @seeking="seek" @seeked="scheduleStop" @ratechange="scheduleStop" />
</template>
