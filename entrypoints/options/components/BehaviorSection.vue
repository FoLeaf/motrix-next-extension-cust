<script lang="ts" setup>
/**
 * @fileoverview Download behavior settings section.
 *
 * Toggle switches for controlling download interception behavior.
 * Uses Naive UI NSwitch, matching the desktop Basic.vue controls.
 */
import { NFormItem, NSwitch, NDivider } from 'naive-ui';

defineProps<{
  enabled: boolean;
  hideDownloadBar: boolean;
  autoLaunchApp: boolean;
  forwardCookies: boolean;
}>();

const emit = defineEmits<{
  'update:enabled': [value: boolean];
  'update:hideDownloadBar': [value: boolean];
  'update:autoLaunchApp': [value: boolean];
  'update:forwardCookies': [value: boolean];
}>();

import { useI18n } from '@/shared/i18n/engine';

const { t: i18n } = useI18n();
</script>

<template>
  <div class="section">
    <NFormItem :label="i18n('options_enabled_label', 'Enable Download Interception')">
      <template #label>
        <div class="label-group">
          <span>{{ i18n('options_enabled_label', 'Enable Download Interception') }}</span>
          <span class="label-hint">{{
            i18n('options_enabled_desc', 'Automatically intercept browser downloads')
          }}</span>
        </div>
      </template>
      <NSwitch :value="enabled" @update:value="emit('update:enabled', $event)" />
    </NFormItem>

    <NDivider />

    <NFormItem :label="i18n('options_hide_download_bar_label', 'Hide Browser Download Bar')">
      <template #label>
        <div class="label-group">
          <span>{{ i18n('options_hide_download_bar_label', 'Hide Browser Download Bar') }}</span>
          <span class="label-hint">{{
            i18n(
              'options_hide_download_bar_desc',
              'Requests optional download UI permission before changing browser UI',
            )
          }}</span>
        </div>
      </template>
      <NSwitch :value="hideDownloadBar" @update:value="emit('update:hideDownloadBar', $event)" />
    </NFormItem>

    <NFormItem :label="i18n('options_auto_launch_label', 'Auto-launch Motrix Next')">
      <template #label>
        <div class="label-group">
          <span>{{ i18n('options_auto_launch_label', 'Auto-launch Motrix Next') }}</span>
          <span class="label-hint">{{
            i18n('options_auto_launch_desc', "Try to launch Motrix Next when it's not running")
          }}</span>
        </div>
      </template>
      <NSwitch :value="autoLaunchApp" @update:value="emit('update:autoLaunchApp', $event)" />
    </NFormItem>

    <NFormItem :label="i18n('options_forward_cookies_label', 'Forward Cookies')">
      <template #label>
        <div class="label-group">
          <span>{{ i18n('options_forward_cookies_label', 'Forward Cookies') }}</span>
          <span class="label-hint">{{
            i18n('options_forward_cookies_desc', 'Forwards cookies for authenticated downloads')
          }}</span>
        </div>
      </template>
      <NSwitch :value="forwardCookies" @update:value="emit('update:forwardCookies', $event)" />
    </NFormItem>
  </div>
</template>

<style scoped>
.section :deep(.n-form-item) {
  display: flex;
  align-items: center;
  gap: 16px;
}

.section :deep(.n-form-item-label) {
  flex: 1;
  min-width: 0;
}

.label-group {
  display: flex;
  flex-direction: column;
}

.label-hint {
  font-size: 12px;
  color: var(--color-on-surface-variant);
  opacity: 0.8;
  margin-top: 2px;
  font-weight: 400;
}
</style>
