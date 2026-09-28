import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React from 'react';
import { useAdmin } from '../../context/AdminContext.js';
export const Breadcrumbs = () => {
    const { breadcrumbs, setRoute } = useAdmin();
    return (_jsxs("div", { className: "admin-breadcrumbs-bar", children: [_jsxs("div", { className: "breadcrumbs-trail", children: [_jsx("a", { href: "#dashboard", onClick: (e) => {
                            e.preventDefault();
                            setRoute('#dashboard');
                        }, children: "Home" }), breadcrumbs.map((item, idx) => (_jsxs(React.Fragment, { children: [_jsx("span", { children: "\u203A" }), item.href && idx < breadcrumbs.length - 1 ? (_jsx("a", { href: item.href, onClick: (e) => {
                                    e.preventDefault();
                                    if (item.href)
                                        setRoute(item.href);
                                }, children: item.label })) : (_jsx("span", { className: "current", children: item.label }))] }, idx)))] }), _jsx("div", { style: {
                    fontSize: '0.6875rem',
                    color: 'var(--chakra-colors-brand-fg)',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                }, children: "\u25CF JSango ORM Active" })] }));
};
//# sourceMappingURL=Breadcrumbs.js.map