import { useModulesStore } from './modules';

describe('useModulesStore', () => {
  beforeEach(() => useModulesStore.getState().reset());

  it('starts with nothing disabled', () => {
    expect(useModulesStore.getState().isDisabled('welfare')).toBe(false);
  });

  it('marks a module disabled', () => {
    useModulesStore.getState().markDisabled('welfare');
    expect(useModulesStore.getState().isDisabled('welfare')).toBe(true);
  });

  it('keeps other modules unaffected', () => {
    useModulesStore.getState().markDisabled('welfare');
    expect(useModulesStore.getState().isDisabled('cooperatives')).toBe(false);
  });

  it('reset clears every disabled module', () => {
    useModulesStore.getState().markDisabled('welfare');
    useModulesStore.getState().reset();
    expect(useModulesStore.getState().isDisabled('welfare')).toBe(false);
  });
});
