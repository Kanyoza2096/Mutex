import React, { lazy, Suspense, useEffect, type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useStore } from './store/useStore';
import { supabase, isSupabaseConfigured } from './lib/supabase';
import Login from './pages/Login';
import Layout from './components/Layout';
import { ErrorBoundary } from './components/ErrorBoundary';
import { SkeletonPage } from './components/Skeleton';

// Route-level code splitting
const RuleBuilder        = lazy(() => import('./pages/RuleBuilder'));
const EmailService       = lazy(() => import('./pages/EmailService'));
const PDFMerger          = lazy(() => import('./pages/PDFMerger'));
const Dashboard          = lazy(() => import('./pages/Dashboard'));
const Posts              = lazy(() => import('./pages/Posts'));
const ApiAnalytics       = lazy(() => import('./pages/ApiAnalytics'));
const Guardian           = lazy(() => import('./pages/Guardian'));
const Settings           = lazy(() => import('./pages/Settings'));
const AIEngine           = lazy(() => import('./pages/AIEngine'));
const PayloadInspector   = lazy(() => import('./pages/PayloadInspector'));
const Workflows          = lazy(() => import('./pages/Workflows'));
const PrometheusMetrics  = lazy(() => import('./pages/PrometheusMetrics'));
const AIBrain            = lazy(() => import('./pages/AIBrain'));
const KnowledgeBase      = lazy(() => import('./pages/KnowledgeBase'));
const Integrations       = lazy(() => import('./pages/Integrations'));
const MISManager         = lazy(() => import('./pages/MISManager'));
const Messenger          = lazy(() => import('./pages/Messenger'));
const Analytics          = lazy(() => import('./pages/Analytics'));
const Scheduler          = lazy(() => import('./pages/Scheduler'));
const Tasks              = lazy(() => import('./pages/Tasks'));
const APIManager         = lazy(() => import('./pages/APIManager'));
const Security           = lazy(() => import('./pages/Security'));
const Users              = lazy(() => import('./pages/Users'));
const AuditLogs          = lazy(() => import('./pages/AuditLogs'));
const Marketplace        = lazy(() => import('./pages/Marketplace'));
const Tenants            = lazy(() => import('./pages/Tenants'));
const Monitoring         = lazy(() => import('./pages/Monitoring'));
const AIChat             = lazy(() => import('./pages/AIChat'));
const Brands             = lazy(() => import('./pages/Brands'));
const AIProfiles         = lazy(() => import('./pages/AIProfiles'));
const Features           = lazy(() => import('./pages/Features'));
const SocialAccounts     = lazy(() => import('./pages/SocialAccounts'));
const Notifications      = lazy(() => import('./pages/Notifications'));
const DataFlowVisualizer = lazy(() => import('./pages/DataFlowVisualizer'));
const SystemArchitecture = lazy(() => import('./pages/SystemArchitecture'));
const ServiceDetail      = lazy(() => import('./pages/ServiceDetail'));
const IncidentCenter     = lazy(() => import('./pages/IncidentCenter'));
const LiveLogs           = lazy(() => import('./pages/LiveLogs'));
const WorkflowRuns       = lazy(() => import('./pages/WorkflowRuns'));
const MetaEngine         = lazy(() => import('./pages/MetaEngine'));
const Director           = lazy(() => import('./pages/Director'));

const isDev = import.meta.env.DEV;

function Page({ name, children }: { name: string; children: ReactNode }) {
  return (
    <ErrorBoundary name={name}>
      <Suspense fallback={<SkeletonPage />}>
        {children}
      </Suspense>
    </ErrorBoundary>
  );
}

export default function App() {
  const isAuthenticated = useStore(state => state.isAuthenticated);
  const login  = useStore(state => state.login);
  const logout = useStore(state => state.logout);

  useEffect(() => {
    if (isDev) console.log('[Kanyoza] Mounted.');

    if (isSupabaseConfigured()) {
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) {
                login();
                localStorage.setItem('kanyoza_authenticated', 'true');
            } else {
                logout();
                localStorage.removeItem('kanyoza_authenticated');
            }
        }).catch(err => {
            console.warn('[Kanyoza] Session fetch failed:', err);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (session) {
                login();
                localStorage.setItem('kanyoza_authenticated', 'true');
            } else if (event === 'SIGNED_OUT') {
                logout();
                localStorage.removeItem('kanyoza_authenticated');
            }
        });

        const handleStorage = (e: StorageEvent) => {
            if (e.key && ['master_token', 'rest_endpoint', 'ws_endpoint'].includes(e.key)) {
                const rest = localStorage.getItem('rest_endpoint') || '';
                const ws = localStorage.getItem('ws_endpoint') || '';
                const token = localStorage.getItem('master_token') || '';
                useStore.getState().setConnectionParams({ restEndpoint: rest, wsEndpoint: ws, masterToken: token });
            }
        };
        window.addEventListener('storage', handleStorage);

        return () => {
            subscription.unsubscribe();
            window.removeEventListener('storage', handleStorage);
        };
    }
}, [login, logout]);

  return (
    <BrowserRouter>
      <Routes>
        {!isAuthenticated ? (
          <Route path="*" element={<Login />} />
        ) : (
          <Route path="/" element={<Layout />}>
            <Route index            element={<Page name="Dashboard">         <Dashboard />         </Page>} />
            <Route path="ai-brain"  element={<Page name="AI Brain">          <AIBrain />           </Page>} />
            <Route path="workflows" element={<Page name="Workflows">         <Workflows />         </Page>} />
            <Route path="posts"     element={<Page name="Posts">             <Posts />             </Page>} />
            <Route path="knowledge-base" element={<Page name="Knowledge Base"><KnowledgeBase />     </Page>} />
            <Route path="integrations" element={<Page name="Integrations">   <Integrations />      </Page>} />
            <Route path="mis"       element={<Page name="MIS Manager">       <MISManager />        </Page>} />
            <Route path="email-service" element={<Page name="Email Service"><EmailService />       </Page>} />
            <Route path="messenger" element={<Page name="Messenger">         <Messenger />         </Page>} />
            <Route path="analytics" element={<Page name="Analytics">         <Analytics />         </Page>} />
            <Route path="scheduler" element={<Page name="Scheduler">         <Scheduler />         </Page>} />
            <Route path="rules"     element={<Page name="Rule Builder">     <RuleBuilder />       </Page>} />
            <Route path="tasks"     element={<Page name="Tasks">             <Tasks />             </Page>} />
            <Route path="api-manager" element={<Page name="API Manager">     <APIManager />        </Page>} />
            <Route path="security"  element={<Page name="Security">          <Security />          </Page>} />
            <Route path="users"     element={<Page name="Users">             <Users />             </Page>} />
            <Route path="audit-logs" element={<Page name="Audit Logs">       <AuditLogs />         </Page>} />
            <Route path="marketplace" element={<Page name="Marketplace">     <Marketplace />       </Page>} />
            <Route path="tenants"   element={<Page name="Tenants">           <Tenants />           </Page>} />
            <Route path="brands"    element={<Page name="Brands">            <Brands />            </Page>} />
            <Route path="ai-profiles" element={<Page name="AI Profiles">     <AIProfiles />        </Page>} />
            <Route path="features"  element={<Page name="Features">          <Features />          </Page>} />
            <Route path="monitoring" element={<Page name="Monitoring">       <Monitoring />        </Page>} />
            <Route path="ai-chat"   element={<Page name="AI Chat">           <AIChat />            </Page>} />
            <Route path="engine"    element={<Page name="AI Engine">         <AIEngine />          </Page>} />
            <Route path="payloads"  element={<Page name="Payload Inspector"> <PayloadInspector />  </Page>} />
            <Route path="pdf-merger" element={<Page name="PDF Merger"><PDFMerger /></Page>} />
            <Route path="api"       element={<Page name="API Analytics">     <ApiAnalytics />      </Page>} />
            <Route path="prometheus" element={<Page name="Prometheus">       <PrometheusMetrics /> </Page>} />
            <Route path="social-accounts" element={<Page name="Social Accounts"><SocialAccounts />  </Page>} />
            <Route path="guardian"  element={<Page name="Guardian">          <Guardian />          </Page>} />
            <Route path="notifications" element={<Page name="Notifications"> <Notifications />     </Page>} />
            <Route path="data-flow" element={<Page name="Data Flow">         <DataFlowVisualizer /> </Page>} />
            <Route path="system-architecture" element={<Page name="System Architecture"><SystemArchitecture /></Page>} />
            <Route path="services/:serviceId" element={<Page name="Service Detail"><ServiceDetail /></Page>} />
            <Route path="incident-center" element={<Page name="Incident Center"><IncidentCenter /></Page>} />
            <Route path="live-logs" element={<Page name="Live Logs">         <LiveLogs />          </Page>} />
            <Route path="workflow-runs" element={<Page name="Workflow Runs"> <WorkflowRuns />      </Page>} />
            <Route path="settings"  element={<Page name="Settings">          <Settings />          </Page>} />
            <Route path="overseer" element={<Page name="Overseer">           <MetaEngine />        </Page>} />
            <Route path="director" element={<Page name="Director">           <Director /></Page>} />
            <Route path="*"         element={<Navigate to="/" replace />} />
          </Route>
        )}
      </Routes>
    </BrowserRouter>
  );
}
