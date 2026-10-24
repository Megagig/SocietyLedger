import { ChevronDown, ChevronRight } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, Switch as RNSwitch, View } from 'react-native';

import { SearchField } from '@/components/forms/SearchField';
import { Divider } from '@/components/ui/Divider';
import { Text } from '@/components/ui/Text';
import { useThemeTokens } from '@/providers/ThemeProvider';
import type { PermissionDTO } from '@/types/api/rbac';
import { canGrantPermission, groupPermissions, searchPermissions } from '../labels';

/**
 * A role's permissions grouped by part of the app. Each group opens to switches, and has one control to turn the whole group on or
 * off. A search finds a permission by its wording or key. A switch is offered only where it can work: a permission the person does
 * not hold can be switched off (if the role has it) but never on. With `readOnly` nothing can be changed.
 */
export function PermissionEditor({
  permissions,
  selected,
  original,
  held,
  readOnly,
  onToggle,
  onToggleMany,
}: {
  permissions: PermissionDTO[];
  selected: ReadonlySet<string>;
  /** What the role had when it was opened: those can always be kept, whoever is editing. */
  original: ReadonlySet<string>;
  held: readonly string[];
  readOnly: boolean;
  onToggle: (key: string, on: boolean) => void;
  /** Turn several permissions on or off together (a whole group). */
  onToggleMany: (keys: string[], on: boolean) => void;
}) {
  const { color } = useThemeTokens();
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [query, setQuery] = useState('');
  const searching = query.trim() !== '';
  const groups = groupPermissions(searchPermissions(permissions, query))
    // Someone editing never sees permissions that are off and that they could not switch on
    .map((g) => ({ ...g, items: readOnly ? g.items.filter((p) => selected.has(p.key)) : g.items.filter((p) => selected.has(p.key) || original.has(p.key) || canGrantPermission(held, p.key)) }))
    .filter((g) => g.items.length > 0);

  return (
    <View className="gap-3">
      <SearchField value={query} onChangeText={setQuery} placeholder="Search permissions" testID="perm-search" />
      {groups.length === 0 ? (
        <Text variant="body" tone="secondary" testID="perm-none">
          No permission matches &ldquo;{query.trim()}&rdquo;.
        </Text>
      ) : (
        <View className="overflow-hidden rounded-md border border-border bg-surface dark:border-transparent">
          {groups.map((group, index) => {
            // A search opens every group that has a match, so the match is not hidden behind a tap
            const isOpen = searching || !!open[group.module];
            const on = group.items.filter((p) => selected.has(p.key)).length;
            const turnable = group.items.filter((p) => !selected.has(p.key) && (original.has(p.key) || canGrantPermission(held, p.key))).map((p) => p.key);
            const allOn = on === group.items.length;
            return (
              <View key={group.module}>
                {index > 0 ? <Divider /> : null}
                <Pressable
                  onPress={() => setOpen((prev) => ({ ...prev, [group.module]: !isOpen }))}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: isOpen }}
                  accessibilityLabel={`${group.module}, ${on} of ${group.items.length} on`}
                  className="min-h-[52px] flex-row items-center justify-between px-4 py-3"
                  testID={`perm-group-${group.module}`}
                >
                  <View className="flex-1">
                    <Text variant="body-lg">{group.module}</Text>
                    <Text variant="caption" tone="secondary">
                      {on} of {group.items.length} on
                    </Text>
                  </View>
                  {isOpen ? <ChevronDown size={20} color={color.textTertiary} strokeWidth={1.75} /> : <ChevronRight size={20} color={color.textTertiary} strokeWidth={1.75} />}
                </Pressable>
                {isOpen && !readOnly && (allOn ? on > 0 : turnable.length > 0) ? (
                  <>
                    <Divider />
                    <Pressable
                      onPress={() => (allOn ? onToggleMany(group.items.map((p) => p.key), false) : onToggleMany(turnable, true))}
                      accessibilityRole="button"
                      className="min-h-[44px] justify-center px-4 py-2"
                      testID={`perm-all-${group.module}`}
                    >
                      <Text variant="body" tone="primary">
                        {allOn ? `Turn all of ${group.module} off` : `Turn all of ${group.module} on`}
                      </Text>
                    </Pressable>
                  </>
                ) : null}
                {isOpen
                  ? group.items.map((p) => {
                      const checked = selected.has(p.key);
                      const canTurnOn = checked || original.has(p.key) || canGrantPermission(held, p.key);
                      return (
                        <View key={p.key}>
                          <Divider />
                          <Pressable
                            onPress={readOnly || !canTurnOn ? undefined : () => onToggle(p.key, !checked)}
                            accessibilityRole={readOnly ? 'text' : 'switch'}
                            accessibilityState={{ checked }}
                            className="min-h-[52px] flex-row items-center gap-3 px-4 py-2"
                          >
                            <Text variant="body" className="flex-1">
                              {p.description}
                            </Text>
                            {readOnly ? null : (
                              <RNSwitch
                                testID={`perm-${p.key}`}
                                value={checked}
                                disabled={!canTurnOn}
                                onValueChange={(v) => onToggle(p.key, v)}
                                trackColor={{ false: color.borderStrong, true: color.primary }}
                                thumbColor={color.surface}
                              />
                            )}
                          </Pressable>
                        </View>
                      );
                    })
                  : null}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}
