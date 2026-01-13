'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Container,
  Title,
  Text,
  Card,
  Stack,
  Group,
  Button,
  TextInput,
  Select,
  Switch,
  Divider,
  Alert,
  LoadingOverlay,
  Skeleton,
} from '@mantine/core';
import {
  IconUser,
  IconMail,
  IconPhone,
  IconMapPin,
  IconBell,
  IconShield,
  IconCheck,
  IconAlertCircle,
} from '@tabler/icons-react';
import { useAuthStore } from '@/store/authStore';
import { membersApi, Member } from '@/lib/api/members';
import { notifications } from '@mantine/notifications';

export default function MemberSettingsPage() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Fetch current user's member profile
  const { data: memberData, isLoading: memberLoading, error: memberError } = useQuery({
    queryKey: ['member-profile'],
    queryFn: () => membersApi.getMe(),
    retry: 1,
  });

  // Form state for profile settings - initialize with member data when available
  const [profileData, setProfileData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    country: 'Nigeria',
  });

  // Update form data when member data is loaded
  React.useEffect(() => {
    if (memberData) {
      setProfileData({
        firstName: memberData.firstName || '',
        lastName: memberData.lastName || '',
        email: memberData.email || user?.email || '',
        phone: memberData.phone || '',
        address: memberData.address || '',
        city: memberData.city || '',
        state: memberData.state || '',
        country: memberData.country || 'Nigeria',
      });
    }
  }, [memberData, user?.email]);

  // Notification preferences
  const [notificationSettings, setNotificationSettings] = useState({
    emailNotifications: true,
    smsNotifications: false,
    paymentReminders: true,
    meetingNotifications: true,
    announcementNotifications: true,
  });

  // Privacy settings
  const [privacySettings, setPrivacySettings] = useState({
    profileVisibility: 'members', // 'public', 'members', 'private'
    showContactInfo: true,
    showFinancialInfo: false,
  });

  const handleProfileUpdate = async () => {
    setLoading(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
      
      notifications.show({
        title: 'Profile Updated',
        message: 'Your profile has been updated successfully.',
        color: 'green',
        icon: <IconCheck size={16} />,
      });
    } catch (error) {
      notifications.show({
        title: 'Update Failed',
        message: 'Failed to update profile. Please try again.',
        color: 'red',
        icon: <IconAlertCircle size={16} />,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleNotificationUpdate = async () => {
    setLoading(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));
      
      notifications.show({
        title: 'Preferences Updated',
        message: 'Your notification preferences have been saved.',
        color: 'green',
        icon: <IconCheck size={16} />,
      });
    } catch (error) {
      notifications.show({
        title: 'Update Failed',
        message: 'Failed to update preferences. Please try again.',
        color: 'red',
        icon: <IconAlertCircle size={16} />,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container size="lg" py="xl">
      <LoadingOverlay visible={loading} overlayProps={{ radius: "sm", blur: 2 }} />
      
      <Stack gap="xl">
        {/* Header */}
        <div>
          <Title order={2}>Member Settings</Title>
          <Text size="sm" c="dimmed" mt="xs">
            Manage your profile, notifications, and privacy preferences
          </Text>
        </div>

        {/* Show error if member data failed to load */}
        {memberError ? (
          <Alert color="red" variant="light" icon={<IconAlertCircle size={16} />}>
            <Text size="sm">
              Failed to load member information. Some features may not work correctly.
            </Text>
          </Alert>
        ) : null}

        {/* Success Message */}
        {showSuccess ? (
          <Alert color="green" variant="light" icon={<IconCheck size={16} />}>
            Your settings have been updated successfully!
          </Alert>
        ) : null}

        {/* Profile Information */}
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Stack gap="md">
            <Group gap="sm">
              <IconUser className="text-teal-600" size={24} />
              <Title order={4}>Profile Information</Title>
            </Group>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <TextInput
                label="First Name"
                placeholder="Enter your first name"
                value={profileData.firstName}
                onChange={(e) => setProfileData(prev => ({ ...prev, firstName: e.target.value }))}
              />
              <TextInput
                label="Last Name"
                placeholder="Enter your last name"
                value={profileData.lastName}
                onChange={(e) => setProfileData(prev => ({ ...prev, lastName: e.target.value }))}
              />
              <TextInput
                label="Email Address"
                placeholder="Enter your email"
                value={profileData.email}
                onChange={(e) => setProfileData(prev => ({ ...prev, email: e.target.value }))}
                leftSection={<IconMail size={16} />}
              />
              <TextInput
                label="Phone Number"
                placeholder="Enter your phone number"
                value={profileData.phone}
                onChange={(e) => setProfileData(prev => ({ ...prev, phone: e.target.value }))}
                leftSection={<IconPhone size={16} />}
              />
              <TextInput
                label="Address"
                placeholder="Enter your address"
                value={profileData.address}
                onChange={(e) => setProfileData(prev => ({ ...prev, address: e.target.value }))}
                leftSection={<IconMapPin size={16} />}
              />
              <TextInput
                label="City"
                placeholder="Enter your city"
                value={profileData.city}
                onChange={(e) => setProfileData(prev => ({ ...prev, city: e.target.value }))}
              />
              <TextInput
                label="State"
                placeholder="Enter your state"
                value={profileData.state}
                onChange={(e) => setProfileData(prev => ({ ...prev, state: e.target.value }))}
              />
              <Select
                label="Country"
                placeholder="Select your country"
                value={profileData.country}
                onChange={(value) => setProfileData(prev => ({ ...prev, country: value || 'Nigeria' }))}
                data={[
                  { value: 'Nigeria', label: 'Nigeria' },
                  { value: 'Ghana', label: 'Ghana' },
                  { value: 'Kenya', label: 'Kenya' },
                  { value: 'South Africa', label: 'South Africa' },
                ]}
              />
            </div>

            <Group justify="flex-end" mt="md">
              <Button onClick={handleProfileUpdate} loading={loading}>
                Update Profile
              </Button>
            </Group>
          </Stack>
        </Card>

        {/* Notification Preferences */}
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Stack gap="md">
            <Group gap="sm">
              <IconBell className="text-teal-600" size={24} />
              <Title order={4}>Notification Preferences</Title>
            </Group>

            <Stack gap="sm">
              <Switch
                label="Email Notifications"
                description="Receive notifications via email"
                checked={notificationSettings.emailNotifications}
                onChange={(e) => setNotificationSettings(prev => ({ 
                  ...prev, 
                  emailNotifications: e.currentTarget.checked 
                }))}
              />
              <Switch
                label="SMS Notifications"
                description="Receive notifications via SMS"
                checked={notificationSettings.smsNotifications}
                onChange={(e) => setNotificationSettings(prev => ({ 
                  ...prev, 
                  smsNotifications: e.currentTarget.checked 
                }))}
              />
              <Divider />
              <Switch
                label="Payment Reminders"
                description="Get notified about upcoming dues and payments"
                checked={notificationSettings.paymentReminders}
                onChange={(e) => setNotificationSettings(prev => ({ 
                  ...prev, 
                  paymentReminders: e.currentTarget.checked 
                }))}
              />
              <Switch
                label="Meeting Notifications"
                description="Get notified about meetings and events"
                checked={notificationSettings.meetingNotifications}
                onChange={(e) => setNotificationSettings(prev => ({ 
                  ...prev, 
                  meetingNotifications: e.currentTarget.checked 
                }))}
              />
              <Switch
                label="Announcement Notifications"
                description="Get notified about association announcements"
                checked={notificationSettings.announcementNotifications}
                onChange={(e) => setNotificationSettings(prev => ({ 
                  ...prev, 
                  announcementNotifications: e.currentTarget.checked 
                }))}
              />
            </Stack>

            <Group justify="flex-end" mt="md">
              <Button onClick={handleNotificationUpdate} loading={loading}>
                Save Preferences
              </Button>
            </Group>
          </Stack>
        </Card>

        {/* Privacy Settings */}
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Stack gap="md">
            <Group gap="sm">
              <IconShield className="text-teal-600" size={24} />
              <Title order={4}>Privacy Settings</Title>
            </Group>

            <Stack gap="sm">
              <div>
                <Text size="sm" fw={500} mb="xs">Profile Visibility</Text>
                <Select
                  placeholder="Select visibility level"
                  value={privacySettings.profileVisibility}
                  onChange={(value) => setPrivacySettings(prev => ({ 
                    ...prev, 
                    profileVisibility: value || 'members' 
                  }))}
                  data={[
                    { value: 'public', label: 'Public - Visible to everyone' },
                    { value: 'members', label: 'Members Only - Visible to association members' },
                    { value: 'private', label: 'Private - Only visible to admins' },
                  ]}
                />
              </div>
              
              <Divider />
              
              <Switch
                label="Show Contact Information"
                description="Allow other members to see your contact details"
                checked={privacySettings.showContactInfo}
                onChange={(e) => setPrivacySettings(prev => ({ 
                  ...prev, 
                  showContactInfo: e.currentTarget.checked 
                }))}
              />
              <Switch
                label="Show Financial Information"
                description="Allow admins to see your financial status in reports"
                checked={privacySettings.showFinancialInfo}
                onChange={(e) => setPrivacySettings(prev => ({ 
                  ...prev, 
                  showFinancialInfo: e.currentTarget.checked 
                }))}
              />
            </Stack>

            <Group justify="flex-end" mt="md">
              <Button onClick={handleNotificationUpdate} loading={loading}>
                Save Privacy Settings
              </Button>
            </Group>
          </Stack>
        </Card>

        {/* Account Information */}
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Stack gap="md">
            <Title order={4}>Account Information</Title>
            
            {memberLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Text size="sm" fw={500} c="dimmed">Member ID</Text>
                  <Skeleton height={20} width="60%" />
                </div>
                <div>
                  <Text size="sm" fw={500} c="dimmed">Member Since</Text>
                  <Skeleton height={20} width="80%" />
                </div>
                <div>
                  <Text size="sm" fw={500} c="dimmed">Status</Text>
                  <Skeleton height={20} width="50%" />
                </div>
                <div>
                  <Text size="sm" fw={500} c="dimmed">Category</Text>
                  <Skeleton height={20} width="70%" />
                </div>
              </div>
            ) : memberError ? (
              <Alert color="red" variant="light">
                <Text size="sm">
                  Unable to load member information. Please try refreshing the page.
                </Text>
              </Alert>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Text size="sm" fw={500} c="dimmed">Member ID</Text>
                  <Text size="sm">{memberData?.memberId || 'Not assigned'}</Text>
                </div>
                <div>
                  <Text size="sm" fw={500} c="dimmed">Member Since</Text>
                  <Text size="sm">
                    {memberData?.joinDate ? new Date(memberData.joinDate).toLocaleDateString() : 'N/A'}
                  </Text>
                </div>
                <div>
                  <Text size="sm" fw={500} c="dimmed">Status</Text>
                  <Text size="sm" c={memberData?.status === 'active' ? 'green' : 'orange'}>
                    {memberData?.status?.toUpperCase() || 'UNKNOWN'}
                  </Text>
                </div>
                <div>
                  <Text size="sm" fw={500} c="dimmed">Category</Text>
                  <Text size="sm">{memberData?.category?.toUpperCase() || 'REGULAR'}</Text>
                </div>
              </div>
            )}

            <Alert color="blue" variant="light">
              <Text size="sm">
                <strong>Note:</strong> Some account information can only be updated by association administrators. 
                Contact your admin if you need to change your member ID, status, or category.
              </Text>
            </Alert>
          </Stack>
        </Card>
      </Stack>
    </Container>
  );
}