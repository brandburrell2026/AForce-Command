import { useEffect, useRef } from "react";
import { ClerkProvider, SignIn, SignUp, Show, useClerk } from "@clerk/react";
import { shadcn } from "@clerk/themes";
import { Switch, Route, useLocation, Router as WouterRouter, Redirect } from "wouter";
import { queryClient } from "@/lib/queryClient";
import { QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import Home from "@/pages/Home";
import ExecutiveDashboard from "@/pages/ExecutiveDashboard";
import ProductDashboard from "@/pages/ProductDashboard";
import ActivationDashboard from "@/pages/ActivationDashboard";
import VoiceCheckInDashboard from "@/pages/VoiceCheckInDashboard";
import TerritoryEngagementDashboard from "@/pages/TerritoryEngagementDashboard";
import PerformanceAgeTrendsDashboard from "@/pages/PerformanceAgeTrendsDashboard";
import MarketingDashboard from "@/pages/MarketingDashboard";
import PlaceholderDashboard from "@/pages/PlaceholderDashboard";
import { Layout } from "@/components/Layout";

// The pinned @clerk/react@6.4.3 (catalog-locked to stay consistent with
// @clerk/expo + React 19.1.0) does not export the `publishableKeyFromHost`
// host-mapping helper, so we read the auto-provisioned publishable key
// directly. This founder cockpit is single-domain, so the multi-custom-domain
// resolution that helper provides is not needed here.
const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

// Empty in dev (Clerk hits dev FAPI directly), auto-populated in prod.
// Passed to proxyUrl unconditionally — do not gate on NODE_ENV/PROD.
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

// Strip base helper for Clerk router integration
function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

if (!clerkPubKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY in .env file");
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: "hsl(3 100% 60%)",
    colorForeground: "hsl(0 0% 98%)",
    colorMutedForeground: "hsl(0 0% 60%)",
    colorDanger: "hsl(0 100% 50%)",
    colorBackground: "hsl(0 0% 2%)",
    colorInput: "hsl(0 0% 15%)",
    colorInputForeground: "hsl(0 0% 98%)",
    colorNeutral: "hsl(0 0% 20%)",
    fontFamily: "'Inter', sans-serif",
    borderRadius: "0.5rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-[#050505] border border-white/10 rounded-2xl w-[440px] max-w-full overflow-hidden shadow-2xl",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none border-t border-white/5",
    headerTitle: "text-foreground font-bold tracking-tight",
    headerSubtitle: "text-muted-foreground",
    socialButtonsBlockButtonText: "text-foreground font-medium",
    formFieldLabel: "text-foreground font-medium text-xs tracking-wider uppercase",
    footerActionLink: "text-primary hover:text-primary/80 font-medium",
    footerActionText: "text-muted-foreground",
    dividerText: "text-muted-foreground bg-[#050505] px-2",
    dividerLine: "bg-white/10",
    identityPreviewEditButton: "text-primary",
    formFieldSuccessText: "text-secondary",
    alertText: "text-foreground",
    logoImage: "h-8",
    socialButtonsBlockButton: "bg-white/5 border-white/10 hover:bg-white/10 text-foreground transition-colors",
    formButtonPrimary: "bg-primary hover:bg-primary/90 text-primary-foreground font-semibold tracking-wide shadow-[0_0_15px_rgba(255,59,48,0.2)]",
    formFieldInput: "bg-black border-white/10 text-foreground placeholder:text-white/20 focus:border-primary focus:ring-primary/20",
    footerAction: "bg-transparent",
    alert: "bg-destructive/10 border-destructive/20",
    otpCodeFieldInput: "border-white/10 bg-black text-foreground focus:border-primary",
  },
};

function SignInPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-black px-4 relative overflow-hidden">
      <div className="absolute inset-0 flex items-center justify-center opacity-20 pointer-events-none">
        <div className="w-[80vw] h-[80vw] md:w-[40vw] md:h-[40vw] bg-primary/30 rounded-full blur-[120px]" />
      </div>
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-black px-4 relative overflow-hidden">
      <div className="absolute inset-0 flex items-center justify-center opacity-20 pointer-events-none">
        <div className="w-[80vw] h-[80vw] md:w-[40vw] md:h-[40vw] bg-primary/30 rounded-full blur-[120px]" />
      </div>
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
    </div>
  );
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const queryClient = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (
        prevUserIdRef.current !== undefined &&
        prevUserIdRef.current !== userId
      ) {
        queryClient.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, queryClient]);

  return null;
}

function HomeRedirect() {
  return (
    <>
      <Show when="signed-in">
        <Redirect to="/executive" />
      </Show>
      <Show when="signed-out">
        <Home />
      </Show>
    </>
  );
}

function ProtectedRoute({ component: Component, title }: { component: any, title?: string }) {
  return (
    <>
      <Show when="signed-in">
        <Layout basePath={basePath}>
          <Component title={title} />
        </Layout>
      </Show>
      <Show when="signed-out">
        <Redirect to="/" />
      </Show>
    </>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: {
          start: {
            title: "Founder Cockpit",
            subtitle: "Sign in to access telemetry",
          },
        },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <ClerkQueryClientCacheInvalidator />
          <Switch>
            <Route path="/" component={HomeRedirect} />
            <Route path="/sign-in/*?" component={SignInPage} />
            <Route path="/sign-up/*?" component={SignUpPage} />
            
            {/* Protected Routes */}
            <Route path="/executive">
              {() => <ProtectedRoute component={ExecutiveDashboard} />}
            </Route>
            <Route path="/product">
              {() => <ProtectedRoute component={ProductDashboard} />}
            </Route>
            <Route path="/activation">
              {() => <ProtectedRoute component={ActivationDashboard} />}
            </Route>
            <Route path="/voice-checkin">
              {() => <ProtectedRoute component={VoiceCheckInDashboard} />}
            </Route>
            <Route path="/territory">
              {() => <ProtectedRoute component={TerritoryEngagementDashboard} />}
            </Route>
            <Route path="/performance-age">
              {() => <ProtectedRoute component={PerformanceAgeTrendsDashboard} />}
            </Route>
            <Route path="/ai">
              {() => <ProtectedRoute component={PlaceholderDashboard} title="AI" />}
            </Route>
            <Route path="/marketing">
              {() => <ProtectedRoute component={MarketingDashboard} />}
            </Route>
            <Route path="/board">
              {() => <ProtectedRoute component={PlaceholderDashboard} title="Board" />}
            </Route>
            <Route path="/guardian">
              {() => <ProtectedRoute component={PlaceholderDashboard} title="Guardian" />}
            </Route>

            {/* Fallback */}
            <Route>
              <Redirect to="/" />
            </Route>
          </Switch>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}

export default App;
