import { AppLayout } from './components/layout/AppLayout';
import { useTypeInference } from './hooks/useTypeInference';
import { useClearStaleWireValues } from './hooks/useEvaluation';

function AppWithHooks() {
  useTypeInference();
  useClearStaleWireValues();
  return <AppLayout />;
}

export default function App() {
  return <AppWithHooks />;
}
