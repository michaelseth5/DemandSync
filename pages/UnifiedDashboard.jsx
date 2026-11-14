import "../styles/ds-ui.css";
import React from "react";
import { Link, useLocation } from "react-router-dom";
import ChatBot from "../components/ChatBot.jsx";

const alerts = [
  {
    id: 1,
    severity: "high",
    title: "Avocados expiring in 24 hours",
    detail: "Reduce prep on avocado items and push limited offers."
  },
  {
    id: 2,
    severity: "medium",
    title: "Ribeye on hand below par",
    detail: "Suggest adding 60 steaks to the next purchase order."
  },
  {
    id: 3,
    severity: "low",
    title: "Tequila cost up 4 percent",
    detail: "Review cocktail margins and pricing for top sellers."
  }
];

const kpis = [
  { label: "Food cost percent", value: "30.8 percent", helper: "Target 30 percent" },
  { label: "Liquor cost percent", value: "21.4 percent", helper: "Target 22 percent" },
  { label: "Weekly waste percent", value: "3.2 percent", helper: "Target less than 3 percent" },
  { label: "Inventory turnover", value: "8.6x", helper: "Last 30 days" },
  { label: "Vendor on time delivery", value: "96 percent", helper: "Last month" },
  { label: "Prep accuracy", value: "93 percent", helper: "Prepped vs forecast" }
];

const managerActions = [
  {
    title: "Create purchase order",
    description: "Build a suggested order from par levels.",
    href: "/create-purchase-order",
  },
  {
    title: "Receive shipment",
    description: "Check in delivery and update inventory.",
    href: "/receive-shipment",
  },
  {
    title: "View inventory",
    description: "Review on hand vs par by category.",
    href: "/view-inventory",
  },
  {
    title: "Track prices",
    description: "See price changes for key items.",
    href: "/track-prices",
  },
  {
    title: "Chef prep list",
    description: "Generate prep by daypart and forecast.",
    href: "/chef-prep-list",
  },
  {
    title: "Bar order guide",
    description: "Check bottle counts and pour costs.",
    href: "/bar-order-guide",
  },
  {
    title: "Item usage trends",
    description: "Daily, weekly, and monthly consumption rates.",
    href: "/item-usage-trends",
  },
  {
    title: "Weekly forecast summary",
    description: "Expected traffic, sales, labor, and usage.",
    href: "/weekly-forecast-summary",
  },
  {
    title: "Import data",
    description: "Upload Excel or CSV files to import inventory, pricing, or usage data.",
    href: "/import-data",
  },
];

const tabs = [
  { label: "Overview", href: "/dashboard/overview" },
  { label: "Chef", href: "/dashboard/chef" },
  { label: "Bar manager", href: "/dashboard/bar-manager" },
  { label: "Supply chain", href: "/dashboard/supply-chain" },
  { label: "Catalog", href: "/dashboard/catalog" },
];

function DashboardTabs() {
  const location = useLocation();

  return (
    <div className="nav-tabs">
      {tabs.map(tab => {
        const active = location.pathname === tab.href || 
                      (tab.href === "/dashboard/overview" && location.pathname === "/");
        return (
          <Link
            key={tab.href}
            to={tab.href}
            className={`tab-pill ${active ? "active" : ""}`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}

const procurementRows = [
  {
    id: "PO-71214",
    item: "Ribeye 16 oz",
    qty: 60,
    vendor: "US Foods",
    unitCost: 17.50,
    etaDays: 1,
    urgency: "High"
  },
  {
    id: "PO-71215",
    item: "Avocado Hass",
    qty: 80,
    vendor: "Sysco",
    unitCost: 0.95,
    etaDays: 1,
    urgency: "High"
  },
  {
    id: "PO-71216",
    item: "Casamigos Blanco",
    qty: 12,
    vendor: "Republic National",
    unitCost: 38.00,
    etaDays: 2,
    urgency: "High"
  }
];

const ingredientUsage = [
  { name: "Ribeye", value: 85 },
  { name: "Filet", value: 70 },
  { name: "Salmon", value: 65 },
  { name: "Chicken", value: 90 },
  { name: "Asparagus", value: 60 }
];

export default function UnifiedDashboard() {
  return (
    <div className="ds-ui ds-dashboard">
      
      
      <main className="app-shell">
        <div className="top-row">
          {/* Header and nav */}
          <section className="card header-card">
            <div className="header-top">
              <div>
                <div className="logo-circle">DS</div>
              </div>
              <div className="selectors">
                <select className="pill-input">
                  <option>Uptown Dallas</option>
                  <option>Plano</option>
                  <option>Houston</option>
                </select>
                <input 
                  className="pill-input" 
                  type="date" 
                  defaultValue={new Date().toISOString().split('T')[0]} 
                />
              </div>
            </div>

            <div style={{ marginTop: 18 }}>
              <p className="app-title">DemandSync · Operations Overview</p>
              <p className="subtitle">
                Restaurant operations, inventory, and cost in one place.
              </p>
            </div>

            <DashboardTabs />
          </section>

          {/* Actions */}
          <section className="card">
            <p className="section-title">Manager actions</p>
            <p className="section-subtitle">
              Shortcuts for daily restaurant workflow.
            </p>
            <div className="actions-grid">
              {managerActions.map((action, idx) => (
                <Link key={idx} to={action.href} className="action-btn">
                  {action.title}
                  <span>{action.description}</span>
                </Link>
              ))}
            </div>
          </section>
        </div>

        {/* Alerts */}
        <section className="card">
          <p className="section-title">Critical alerts</p>
          <p className="section-subtitle">
            Items that need attention before tonight service.
          </p>
          <div className="alerts-list">
            {alerts.map((alert) => (
              <div key={alert.id} className={`alert-card alert-${alert.severity}-main`}>
                <div className="alert-main">
                  <p className="alert-title">{alert.title}</p>
                  <p className="alert-detail">{alert.detail}</p>
                </div>
                <span className={`alert-badge alert-${alert.severity}`}>
                  {alert.severity === "high" ? "High priority" : 
                   alert.severity === "medium" ? "Order today" : "Monitor"}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* KPIs */}
        <section className="card">
          <p className="section-title">Key performance indicators</p>
          <p className="section-subtitle">
            Focused on food, beverage, and inventory performance.
          </p>
          <div className="kpi-grid">
            {kpis.map((kpi, idx) => (
              <div key={idx} className="kpi-card">
                <p className="kpi-label">{kpi.label}</p>
                <p className="kpi-value">{kpi.value}</p>
                <p className="kpi-helper">{kpi.helper}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Bottom section: charts and table */}
        <section className="bottom-grid">
          <section className="card">
            <p className="section-title">Ingredient usage - last 7 days</p>
            <p className="section-subtitle">
              Seven-day usage comparison for selected ingredients.
            </p>
            <div className="mini-chart">
              {ingredientUsage.map((ing, idx) => (
                <div key={idx} className="bar-column">
                  <div className="bar-shell">
                    <div className="bar-fill" style={{ height: `${ing.value}%` }}></div>
                  </div>
                  <p className="bar-label">{ing.name}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="card">
            <p className="section-title">Recommended procurement</p>
            <p className="section-subtitle">
              Based on par levels and short term forecast.
            </p>
            <div className="ds-table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>PO id</th>
                    <th>Item</th>
                    <th>Qty</th>
                    <th>Vendor</th>
                    <th>Unit cost</th>
                    <th>ETA</th>
                    <th>Urgency</th>
                  </tr>
                </thead>
                <tbody>
                  {procurementRows.map((row) => (
                    <tr key={row.id}>
                      <td>{row.id}</td>
                      <td>{row.item}</td>
                      <td>{row.qty}</td>
                      <td>{row.vendor}</td>
                      <td>${row.unitCost.toFixed(2)}</td>
                      <td>{row.etaDays} d</td>
                      <td><span className="badge-urgency">{row.urgency}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </section>
      </main>
      <ChatBot />
    </div>
  );
}
