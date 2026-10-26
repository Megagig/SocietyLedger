'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { IconUser, IconMail, IconPhone, IconMapPin, IconCalendar } from '@tabler/icons-react';
import { Modal, TextInput, Select, Textarea, Button, Group } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useForm } from '@mantine/form';
import { toast } from '@/lib/toast';
import api from '@/lib/axios';
import { ProfilePhotoEditor } from '@/components/members/ProfilePhotoEditor';

interface Member {
  id: number;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  occupation: string | null;
  dateOfBirth: string | null;
  gender: string;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  emergencyContactRelationship: string | null;
  joinDate: string;
  photoUrl?: string | null;
  thumbUrl?: string | null;
}

export default function MyProfilePage() {
  const { user } = useAuthStore();
  const [editOpened, { open: openEdit, close: closeEdit }] = useDisclosure(false);
  const [passwordOpened, { open: openPassword, close: closePassword }] = useDisclosure(false);
  const [memberData, setMemberData] = useState<Member | null>(null);
  const [loading, setLoading] = useState(false);

  const form = useForm({
    initialValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      address: '',
      city: '',
      state: '',
      country: '',
      occupation: '',
      dateOfBirth: '',
      gender: 'male',
      emergencyContactName: '',
      emergencyContactPhone: '',
      emergencyContactRelationship: '',
    },
  });

  const passwordForm = useForm({
    initialValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
    validate: {
      newPassword: (value) => (value.length < 6 ? 'Password must be at least 6 characters' : null),
      confirmPassword: (value, values) =>
        value !== values.newPassword ? 'Passwords do not match' : null,
    },
  });

  useEffect(() => {
    fetchMemberData();
  }, []);

  const fetchMemberData = async () => {
    try {
      const response = await api.get('/members/me');
      if (response.data.success) {
        const member = response.data.data;
        setMemberData(member);
        form.setValues({
          firstName: member.firstName || '',
          lastName: member.lastName || '',
          email: member.email || '',
          phone: member.phone || '',
          address: member.address || '',
          city: member.city || '',
          state: member.state || '',
          country: member.country || '',
          occupation: member.occupation || '',
          dateOfBirth: member.dateOfBirth ? member.dateOfBirth.split('T')[0] : '',
          gender: member.gender || 'male',
          emergencyContactName: member.emergencyContactName || '',
          emergencyContactPhone: member.emergencyContactPhone || '',
          emergencyContactRelationship: member.emergencyContactRelationship || '',
        });
      }
    } catch (error: any) {
      console.error('Error fetching member data:', error);
      toast.error(error.response?.data?.message || 'Failed to load profile data');
    }
  };

  const handleEditProfile = async (values: typeof form.values) => {
    setLoading(true);
    try {
      const response = await api.patch('/members/me', {
        ...values,
        dateOfBirth: values.dateOfBirth ? new Date(values.dateOfBirth).toISOString() : null,
      });

      if (response.data.success) {
        toast.success('Profile updated successfully');
        closeEdit();
        fetchMemberData();
      }
    } catch (error: any) {
      console.error('Error updating profile:', error);
      toast.error(error.response?.data?.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (values: typeof passwordForm.values) => {
    setLoading(true);
    try {
      const response = await api.post('/auth/change-password', {
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });

      if (response.data.success) {
        toast.success('Password changed successfully');
        closePassword();
        passwordForm.reset();
      }
    } catch (error: any) {
      console.error('Error changing password:', error);
      toast.error(error.response?.data?.message || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-teal-600 to-green-600 dark:from-teal-400 dark:to-green-400 bg-clip-text text-transparent mb-2">
          My Profile
        </h1>
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
          View and manage your personal information
        </p>
      </div>

      <div className="space-y-6">
        {/* Profile Card */}
        <div className="glass rounded-2xl p-6 shadow-xl">
          <div className="flex items-center gap-6 mb-6">
            <ProfilePhotoEditor
              name={memberData ? `${memberData.firstName} ${memberData.lastName}` : user?.email?.split('@')[0] || 'Member'}
              imageUrl={memberData?.photoUrl}
              target="me"
              onChanged={() => fetchMemberData()}
            />
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {memberData ? `${memberData.firstName} ${memberData.lastName}` : user?.email?.split('@')[0] || 'Member'}
              </h2>
              <p className="text-gray-600 dark:text-gray-400 capitalize">
                {user?.role?.replace('_', ' ') || 'Member'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <InfoField
              icon={<IconMail size={20} />}
              label="Email Address"
              value={memberData?.email || user?.email || 'Not provided'}
            />
            <InfoField
              icon={<IconPhone size={20} />}
              label="Phone Number"
              value={memberData?.phone || 'Not provided'}
            />
            <InfoField
              icon={<IconMapPin size={20} />}
              label="Address"
              value={memberData?.address || 'Not provided'}
            />
            <InfoField
              icon={<IconCalendar size={20} />}
              label="Member Since"
              value={memberData?.joinDate ? new Date(memberData.joinDate).toLocaleDateString() : 'Not available'}
            />
          </div>
        </div>

        {/* Emergency Contact */}
        <div className="glass rounded-2xl p-6 shadow-xl">
          <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
            Emergency Contact
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <InfoField
              icon={<IconUser size={20} />}
              label="Contact Name"
              value={memberData?.emergencyContactName || 'Not provided'}
            />
            <InfoField
              icon={<IconPhone size={20} />}
              label="Contact Phone"
              value={memberData?.emergencyContactPhone || 'Not provided'}
            />
          </div>
        </div>

        {/* Account Settings */}
        <div className="glass rounded-2xl p-6 shadow-xl">
          <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
            Account Settings
          </h3>
          <div className="space-y-4">
            <button 
              onClick={openEdit}
              className="w-full sm:w-auto px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
            >
              Edit Profile
            </button>
            <button 
              onClick={openPassword}
              className="w-full sm:w-auto px-6 py-3 ml-0 sm:ml-4 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Change Password
            </button>
          </div>
        </div>
      </div>

      {/* Edit Profile Modal */}
      <Modal opened={editOpened} onClose={closeEdit} title="Edit Profile" size="lg">
        <form onSubmit={form.onSubmit(handleEditProfile)}>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <TextInput
                label="First Name"
                placeholder="Enter first name"
                required
                {...form.getInputProps('firstName')}
              />
              <TextInput
                label="Last Name"
                placeholder="Enter last name"
                required
                {...form.getInputProps('lastName')}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <TextInput
                label="Email"
                placeholder="Enter email"
                type="email"
                {...form.getInputProps('email')}
              />
              <TextInput
                label="Phone"
                placeholder="Enter phone number"
                {...form.getInputProps('phone')}
              />
            </div>

            <TextInput
              label="Address"
              placeholder="Enter address"
              {...form.getInputProps('address')}
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <TextInput
                label="City"
                placeholder="Enter city"
                {...form.getInputProps('city')}
              />
              <TextInput
                label="State"
                placeholder="Enter state"
                {...form.getInputProps('state')}
              />
              <TextInput
                label="Country"
                placeholder="Enter country"
                {...form.getInputProps('country')}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <TextInput
                label="Occupation"
                placeholder="Enter occupation"
                {...form.getInputProps('occupation')}
              />
              <TextInput
                label="Date of Birth"
                type="date"
                {...form.getInputProps('dateOfBirth')}
              />
            </div>

            <Select
              label="Gender"
              placeholder="Select gender"
              data={[
                { value: 'male', label: 'Male' },
                { value: 'female', label: 'Female' },
                { value: 'other', label: 'Other' },
              ]}
              {...form.getInputProps('gender')}
            />

            <div className="border-t pt-4 mt-4">
              <h4 className="font-semibold mb-3 text-gray-900 dark:text-gray-100">Emergency Contact</h4>
              <div className="space-y-4">
                <TextInput
                  label="Contact Name"
                  placeholder="Enter emergency contact name"
                  {...form.getInputProps('emergencyContactName')}
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <TextInput
                    label="Contact Phone"
                    placeholder="Enter emergency contact phone"
                    {...form.getInputProps('emergencyContactPhone')}
                  />
                  <TextInput
                    label="Relationship"
                    placeholder="e.g., Spouse, Parent, Sibling"
                    {...form.getInputProps('emergencyContactRelationship')}
                  />
                </div>
              </div>
            </div>

            <Group justify="flex-end" mt="md">
              <Button variant="light" onClick={closeEdit} disabled={loading}>
                Cancel
              </Button>
              <Button type="submit" loading={loading}>
                Save Changes
              </Button>
            </Group>
          </div>
        </form>
      </Modal>

      {/* Change Password Modal */}
      <Modal opened={passwordOpened} onClose={closePassword} title="Change Password" size="md">
        <form onSubmit={passwordForm.onSubmit(handleChangePassword)}>
          <div className="space-y-4">
            <TextInput
              label="Current Password"
              placeholder="Enter current password"
              type="password"
              required
              {...passwordForm.getInputProps('currentPassword')}
            />
            <TextInput
              label="New Password"
              placeholder="Enter new password"
              type="password"
              required
              {...passwordForm.getInputProps('newPassword')}
            />
            <TextInput
              label="Confirm New Password"
              placeholder="Confirm new password"
              type="password"
              required
              {...passwordForm.getInputProps('confirmPassword')}
            />

            <Group justify="flex-end" mt="md">
              <Button variant="light" onClick={closePassword} disabled={loading}>
                Cancel
              </Button>
              <Button type="submit" loading={loading}>
                Change Password
              </Button>
            </Group>
          </div>
        </form>
      </Modal>
    </>
  );
}

function InfoField({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="p-2 bg-teal-50 dark:bg-teal-900/20 rounded-lg text-teal-600 dark:text-teal-400">
        {icon}
      </div>
      <div>
        <p className="text-sm text-gray-600 dark:text-gray-400">{label}</p>
        <p className="text-base font-medium text-gray-900 dark:text-gray-100">{value}</p>
      </div>
    </div>
  );
}
