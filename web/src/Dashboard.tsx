import { useCallback, useEffect, useState } from 'react';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { Toaster } from './components/ui/Toaster';
import { useAuth } from './context/AuthContext';
import { useToast } from './context/ToastContext';
import { useBuckets } from './hooks/useBuckets';
import { useStats } from './hooks/useStats';
import { NAV_ITEMS } from './lib/navigation';
import { BucketsPage } from './pages/BucketsPage';
import { FilesPage } from './pages/FilesPage';
import { KeysPage } from './pages/KeysPage';
import { OverviewPage } from './pages/OverviewPage';
import { SettingsPage } from './pages/SettingsPage';
import { SharesPage } from './pages/SharesPage';
import { UsersPage } from './pages/UsersPage';
import type { TabId } from './types';

const SUPERADMIN_TABS = new Set<TabId>(
  NAV_ITEMS.filter(item => item.superAdminOnly).map(item => item.id)
);

export function Dashboard() {
  const { isSuperAdmin, refreshUser } = useAuth();
  const { showToast } = useToast();
  const { stats, refresh: refreshStats } = useStats();
  const {
    buckets,
    loading: bucketsLoading,
    refresh: refreshBuckets,
    createBucket,
    deleteBucket,
    setBucketVisibility
  } = useBuckets();

  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [activeBucket, setActiveBucket] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Bumped by the header refresh button to force the file browser to re-read.
  const [filesViewKey, setFilesViewKey] = useState(0);

  // Pick up a role change made by another superadmin without requiring a re-login.
  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  // A demoted user must never be left staring at a privileged tab.
  useEffect(() => {
    if (!isSuperAdmin && SUPERADMIN_TABS.has(activeTab)) {
      setActiveTab('overview');
    }
  }, [isSuperAdmin, activeTab]);

  // Opening the file browser without a selection lands on the first bucket.
  useEffect(() => {
    if (activeTab === 'files' && !activeBucket && buckets.length > 0) {
      setActiveBucket(buckets[0].name);
    }
  }, [activeTab, activeBucket, buckets]);

  const refreshDashboard = useCallback(async () => {
    await Promise.all([refreshStats(), refreshBuckets()]);
  }, [refreshStats, refreshBuckets]);

  const handleHeaderRefresh = () => {
    void refreshDashboard();
    setFilesViewKey(key => key + 1);
    showToast('Data diperbarui.', 'info');
  };

  const handleDeleteBucket = async (name: string) => {
    const deleted = await deleteBucket(name);
    if (deleted) {
      if (activeBucket === name) setActiveBucket('');
      await refreshStats();
    }
    return deleted;
  };

  const handleCreateBucket = async (name: string, isPublic: boolean) => {
    const created = await createBucket(name, isPublic);
    if (created) await refreshStats();
    return created;
  };

  const handleOpenBucket = (name: string) => {
    setActiveBucket(name);
    setActiveTab('files');
  };

  return (
    <div className="app-container">
      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      {sidebarOpen && (
        <button
          className="sidebar-backdrop"
          onClick={() => setSidebarOpen(false)}
          aria-label="Tutup menu"
        />
      )}

      <main className="main-content">
        <Header
          activeTab={activeTab}
          onRefresh={handleHeaderRefresh}
          onOpenMenu={() => setSidebarOpen(true)}
        />

        <div className="page-body">
          <Toaster />

          {activeTab === 'overview' && <OverviewPage stats={stats} />}

          {activeTab === 'files' && (
            <FilesPage
              key={filesViewKey}
              buckets={buckets}
              activeBucket={activeBucket}
              onActiveBucketChange={setActiveBucket}
              onStorageChanged={() => void refreshDashboard()}
            />
          )}

          {activeTab === 'buckets' && isSuperAdmin && (
            <BucketsPage
              buckets={buckets}
              loading={bucketsLoading}
              onCreate={handleCreateBucket}
              onDelete={handleDeleteBucket}
              onToggleVisibility={setBucketVisibility}
              onOpenBucket={handleOpenBucket}
            />
          )}

          {activeTab === 'shares' && isSuperAdmin && <SharesPage buckets={buckets} />}

          {activeTab === 'keys' && isSuperAdmin && (
            <KeysPage onKeysChanged={() => void refreshStats()} />
          )}

          {activeTab === 'users' && isSuperAdmin && (
            <UsersPage onUsersChanged={() => void refreshStats()} />
          )}

          {activeTab === 'settings' && <SettingsPage />}
        </div>
      </main>
    </div>
  );
}
