import { AppShell } from './components/layout/AppShell';
import { useStore } from './data/store';
import { OrgChartView } from './components/views/OrgChartView';
import { LayeredCircleView } from './components/views/LayeredCircleView';

function App() {
  const {
    currentView
  } = useStore();

  return (
    <AppShell>
      {currentView === 'chart' && <OrgChartView />}
      {currentView === 'circle' && <LayeredCircleView />}
    </AppShell>
  );
}

export default App;
