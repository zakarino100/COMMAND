import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrandProvider } from "@/contexts/BrandContext";
import { AppLayout } from "@/components/layout/AppLayout";
import NotFound from "@/pages/not-found";

import Compose from "@/pages/Compose";
import Queue from "@/pages/Queue";
import History from "@/pages/History";
import Performance from "@/pages/Performance";
import Library from "@/pages/Library";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={Compose} />
      <Route path="/queue" component={Queue} />
      <Route path="/history" component={History} />
      <Route path="/performance" component={Performance} />
      <Route path="/library" component={Library} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <BrandProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <AppLayout>
              <Router />
            </AppLayout>
          </WouterRouter>
        </BrandProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
