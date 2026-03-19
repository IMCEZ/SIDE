import { MainLayout } from '../components/layout/MainLayout';

const PresetsPage = () => {
  return (
    <MainLayout title="预设">
      <div className="pt-4">
        <h1 className="text-xl font-semibold mb-2">预设</h1>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          这里将展示和编辑提示词预设、会话参数等内容。
        </p>
      </div>
    </MainLayout>
  );
};

export default PresetsPage;

