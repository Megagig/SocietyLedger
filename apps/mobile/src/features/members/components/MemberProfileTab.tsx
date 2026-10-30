import { View } from 'react-native';

import { ListGroup } from '@/components/layout/ListItem';
import { Section } from '@/components/layout/Section';
import { Text } from '@/components/ui/Text';
import { formatDate } from '@/lib/dates';
import type { MemberDetailDTO } from '@/types/api/membersManage';
import { categoryLabel, loginStatusLabel } from '../labels';
import { FactRow } from './FactRow';

/** Whole years since the join date, as the web profile's "Member for". */
function yearsSince(iso: string): string {
  const years = Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24 * 365));
  if (years < 1) return 'Less than a year';
  return years === 1 ? '1 year' : `${years} years`;
}

/** MG2 Profile tab — personal details, membership, emergency contact and notes, as on the web profile. */
export function MemberProfileTab({ member, thrift = false }: { member: MemberDetailDTO; /** A standalone thrift group: only the details a circle needs (contact, address, when they joined), none of an association's. */ thrift?: boolean }) {
  const address = [member.address, member.city, member.state, member.country].filter(Boolean).join(', ');
  const hasEmergency = Boolean(member.emergencyContactName || member.emergencyContactPhone);

  if (thrift) {
    return (
      <View className="gap-6">
        <Section title="Contact">
          <ListGroup>
            <FactRow label="Phone" value={member.phone} />
            <FactRow label="Email" value={member.email} />
            <FactRow label="Address" value={address} />
          </ListGroup>
        </Section>
        <Section title="In the group">
          <ListGroup>
            <FactRow label="Joined" value={member.joinDate ? formatDate(member.joinDate, 'long') : null} />
            <FactRow label="Login" value={loginStatusLabel(member.loginStatus)} />
          </ListGroup>
        </Section>
        {hasEmergency ? (
          <Section title="Emergency contact">
            <ListGroup>
              <FactRow label="Name" value={member.emergencyContactName} />
              <FactRow label="Phone" value={member.emergencyContactPhone} />
              <FactRow label="Relationship" value={member.emergencyContactRelationship} />
            </ListGroup>
          </Section>
        ) : null}
      </View>
    );
  }

  return (
    <View className="gap-6">
      <Section title="Personal">
        <ListGroup>
          <FactRow label="Email" value={member.email} />
          <FactRow label="Phone" value={member.phone} />
          <FactRow label="Gender" value={member.gender ? member.gender.charAt(0).toUpperCase() + member.gender.slice(1) : null} />
          <FactRow label="Date of birth" value={member.dateOfBirth ? formatDate(member.dateOfBirth, 'long') : null} />
          <FactRow label="Occupation" value={member.occupation} />
          <FactRow label="Address" value={address} />
        </ListGroup>
      </Section>

      <Section title="Membership">
        <ListGroup>
          <FactRow label="Member ID" value={member.memberId} />
          <FactRow label="Category" value={categoryLabel(member.category)} />
          <FactRow label="Joined" value={member.joinDate ? formatDate(member.joinDate, 'long') : null} />
          <FactRow label="Member for" value={member.joinDate ? yearsSince(member.joinDate) : null} />
          <FactRow label="Login" value={loginStatusLabel(member.loginStatus)} />
        </ListGroup>
      </Section>

      {hasEmergency ? (
        <Section title="Emergency contact">
          <ListGroup>
            <FactRow label="Name" value={member.emergencyContactName} />
            <FactRow label="Phone" value={member.emergencyContactPhone} />
            <FactRow label="Relationship" value={member.emergencyContactRelationship} />
          </ListGroup>
        </Section>
      ) : null}

      {member.notes ? (
        <Section title="Notes">
          <Text variant="body" tone="secondary">
            {member.notes}
          </Text>
        </Section>
      ) : null}
    </View>
  );
}
