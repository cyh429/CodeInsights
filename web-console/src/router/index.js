import { createRouter, createWebHistory } from 'vue-router';
const routes = [
    { path: '/login', name: 'login', component: () => import('../views/LoginPage.vue'), meta: { requiresAuth: false } },
    {
        path: '/share',
        component: () => import('../views/ShareLayout.vue'),
        meta: { requiresAuth: false },
        children: [
            { path: ':id', name: 'share', component: () => import('../views/SharePage.vue') },
        ],
    },
    {
        path: '/',
        name: 'home',
        component: () => import('../views/MainLayout.vue'),
        meta: { requiresAuth: true },
        children: [
            { path: '', name: 'dashboard', component: () => import('../views/HomePage.vue') },
            { path: 'chat/:id', name: 'chat', component: () => import('../views/ChatPage.vue') },
            { path: 'cases', name: 'cases', component: () => import('../views/CaseListPage.vue') },
            { path: 'cases/:id', name: 'case-detail', component: () => import('../views/CaseDetailPage.vue') }
        ]
    }
];
const router = createRouter({
    history: createWebHistory(import.meta.env?.BASE_URL || ''),
    routes
});
router.beforeEach((to, _from, next) => {
    const requiresAuth = to.meta?.requiresAuth ?? false;
    const isLoggedIn = !!localStorage.getItem('rv_access_token');
    if (requiresAuth && !isLoggedIn) {
        next({ name: 'login' });
        return;
    }
    if (to.name === 'login' && isLoggedIn) {
        next({ name: 'home' });
        return;
    }
    next();
});
export default router;
