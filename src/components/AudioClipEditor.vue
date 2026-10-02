<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { audioClipError, formatAudioTime } from '../audioClip';
import { mediaUrl } from '../quiz';
import type { Question } from '../types';
import AudioClipPlayer from './AudioClipPlayer.vue';

const props = defineProps<{ question: Question }>();
const emit = defineEmits<{ dirty: [] }>();
const currentTime = ref(0);
const duration = ref<number>();
const error = computed(() => audioClipError(props.question, duration.value));
const previewClip = ref(false);
watch(() => mediaUrl(props.question.media), () => { duration.value = undefined; currentTime.value = 0; });

function setTime(field: 'audioStart' | 'audioEnd', value: string): void {
  if (!value.trim()) delete props.question[field];
  else props.question[field] = Number(value);
  emit('dirty');
}
function useCurrentTime(field: 'audioStart' | 'audioEnd'): void {
  setTime(field, String(Math.floor(currentTime.value * 10) / 10));
}
function reset(): void {
  delete props.question.audioStart;
  delete props.question.audioEnd;
  emit('dirty');
}
</script>

<template>
  <section class="audio-clip-editor" aria-label="Výběr hudební ukázky">
    <strong>Úsek k přehrání</strong>
    <div class="audio-clip-fields">
      <div class="field"><label :for="`audio-start-${question.id}`">Začátek (sekundy)</label>
        <input :id="`audio-start-${question.id}`" type="number" min="0" step="0.1" placeholder="0" :value="question.audioStart ?? ''" @input="setTime('audioStart', ($event.target as HTMLInputElement).value)" />
        <button class="text-btn" type="button" @click="useCurrentTime('audioStart')">Nastavit z přehrávače</button>
      </div>
      <div class="field"><label :for="`audio-end-${question.id}`">Konec (sekundy)</label>
        <input :id="`audio-end-${question.id}`" type="number" min="0" step="0.1" placeholder="Konec nahrávky" :value="question.audioEnd ?? ''" @input="setTime('audioEnd', ($event.target as HTMLInputElement).value)" />
        <button class="text-btn" type="button" @click="useCurrentTime('audioEnd')">Nastavit z přehrávače</button>
      </div>
    </div>
    <p v-if="error" class="audio-clip-error" role="alert">{{ error }}</p>
    <div class="audio-clip-preview-options">
      <label><input v-model="previewClip" type="checkbox" /> Přehrát jen vybraný úsek</label>
      <span>{{ formatAudioTime(currentTime) }}<template v-if="duration !== undefined"> / {{ formatAudioTime(duration) }}</template></span>
    </div>
    <AudioClipPlayer :key="`${question.id}-${previewClip}`" :src="mediaUrl(question.media)"
      :start="previewClip && !error ? question.audioStart : undefined" :end="previewClip && !error ? question.audioEnd : undefined"
      @time="currentTime = $event" @duration="duration = $event" />
    <div class="tiny">Celá nahrávka zůstává uložená. Prázdný konec = do konce. Např. 90 sekund = 1:30. Změny potvrďte tlačítkem Uložit.</div>
    <button class="text-btn" type="button" @click="reset">Použít celou nahrávku</button>
  </section>
</template>
