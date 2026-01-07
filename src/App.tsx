import { AppShell } from './components/layout/AppShell';
import { useStore } from './data/store';
import { OrgChartView } from './components/views/OrgChartView';
import { LayeredCircleView } from './components/views/LayeredCircleView';
import { UploadWizard } from './components/features/UploadWizard';

function App() {
  const {
    currentView,
    isReadyToVisualize
  } = useStore();

  if (!isReadyToVisualize) {
    return <UploadWizard />;
  }

  return (
    <AppShell>
      {currentView === 'chart' && <OrgChartView />}
      {currentView === 'circle' && <LayeredCircleView />}
    </AppShell>
  );
}

export default App;
