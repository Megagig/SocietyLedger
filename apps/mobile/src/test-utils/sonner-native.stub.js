// sonner-native ships ESM only; Jest can't load it, and no unit test needs real toasts.
const noop = () => undefined;
const toast = Object.assign(noop, { success: noop, error: noop, info: noop, warning: noop, loading: noop, dismiss: noop });
module.exports = { toast, Toaster: () => null };
