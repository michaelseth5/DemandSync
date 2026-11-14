import "../styles/ds-ui.css";
import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import ChatBot from "../components/ChatBot.jsx";
import { INVENTORY_MASTER } from "../data/inventoryMaster.js";

export default function ViewInventory() {
  const [activeTab, setActiveTab] = useState("category");
  const [categoryFilter, setCategoryFilter] = useState("All Categories");
  const [storageFilter, setStorageFilter] = useState("All Storage Areas");
  const [searchQuery, setSearchQuery] = useState("");

  const inventoryItems = useMemo(() => {
    let items = INVENTORY_MASTER.map(item => {
      const difference = item.currentOnHand - item.parLevel;
      const daysOnHand = item.avgDailyUsage > 0 ? (item.currentOnHand / item.avgDailyUsage).toFixed(1) : 999;
      const status = difference < 0 ? "below" : difference > item.parLevel * 0.2 ? "over" : "ok";
      return {
        ...item,
        storageArea: item.storageLocation,
        onHand: item.currentOnHand,
        parLevel: item.parLevel,
        difference,
        avgDailyUsage: item.avgDailyUsage,
        daysOnHand: parseFloat(daysOnHand),
        status
      };
    });

    if (categoryFilter !== "All Categories") {
      items = items.filter(item => item.category === categoryFilter);
    }
    if (storageFilter !== "All Storage Areas") {
      items = items.filter(item => item.storageLocation === storageFilter);
    }
    if (searchQuery) {
      items = items.filter(item => 
        item.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (activeTab === "slow") {
      items = items.filter(item => item.daysOnHand > 14);
    }

    return items;
  }, [categoryFilter, storageFilter, searchQuery, activeTab]);

  const summary = useMemo(() => {
    const totalValue = inventoryItems.reduce((sum, item) => sum + (item.currentOnHand * item.unitCost), 0);
    const belowPar = inventoryItems.filter(item => item.status === "below").length;
    const overPar = inventoryItems.filter(item => item.status === "over").length;
    const avgDaysOnHand = inventoryItems.length > 0 
      ? inventoryItems.reduce((sum, item) => sum + item.daysOnHand, 0) / inventoryItems.length 
      : 0;
    return {
      totalValue,
      belowPar,
      overPar,
      daysOfCover: avgDaysOnHand.toFixed(1)
    };
  }, [inventoryItems]);

  return (
    <div className="ds-ui ds-inventory">
      
      
      <div className="page-container">
        <div className="header-card">
          <Link to="/" style={{ color: "white", textDecoration: "none", fontSize: 14, marginBottom: 16, display: "block" }}>← Back to Dashboard</Link>
          <h1 className="page-title">View Inventory</h1>
          <p className="page-subtitle">Review on hand quantity versus par levels for all categories</p>
        </div>

        <div className="filter-bar">
          <div className="filter-item">
            <select>
              <option>Uptown Dallas</option>
              <option>Plano</option>
              <option>Houston</option>
            </select>
          </div>
          <div className="filter-item">
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
              <option>All Categories</option>
              <option>Produce</option>
              <option>Meats</option>
              <option>Dry Storage</option>
              <option>Spices</option>
              <option>Liquor</option>
              <option>Wine</option>
            </select>
          </div>
          <div className="filter-item">
            <select value={storageFilter} onChange={(e) => setStorageFilter(e.target.value)}>
              <option>All Storage Areas</option>
              <option>Cooler</option>
              <option>Freezer</option>
              <option>Dry</option>
              <option>Bar</option>
              <option>Wine Cellar</option>
            </select>
          </div>
          <div className="filter-item">
            <input type="text" placeholder="Search items..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
        </div>

        <div className="summary-strip">
          <div className="summary-card">
            <div className="summary-label">Total Inventory Value</div>
            <div className="summary-value">${summary.totalValue.toLocaleString()}</div>
          </div>
          <div className="summary-card">
            <div className="summary-label">Items Below Par</div>
            <div className="summary-value" style={{ color: "#b91c1c" }}>{summary.belowPar}</div>
          </div>
          <div className="summary-card">
            <div className="summary-label">Items Over Par</div>
            <div className="summary-value" style={{ color: "#f59e0b" }}>{summary.overPar}</div>
          </div>
          <div className="summary-card">
            <div className="summary-label">Days of Cover</div>
            <div className="summary-value">{summary.daysOfCover}</div>
          </div>
        </div>

        <div className="table-card">
          <div className="tabs">
            <button className={`tab ${activeTab === "category" ? "active" : ""}`} onClick={() => setActiveTab("category")}>By Category</button>
            <button className={`tab ${activeTab === "storage" ? "active" : ""}`} onClick={() => setActiveTab("storage")}>By Storage Area</button>
            <button className={`tab ${activeTab === "slow" ? "active" : ""}`} onClick={() => setActiveTab("slow")}>Slow Movers</button>
          </div>
          <div className="ds-table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Category</th>
                  <th>Storage Area</th>
                  <th>On Hand</th>
                  <th>Par Level</th>
                  <th>Difference</th>
                  <th>Avg Daily Usage</th>
                  <th>Days On Hand</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {inventoryItems.length === 0 && <tr><td colSpan={9} className="ds-empty">No inventory items match your filters.</td></tr>}
                {inventoryItems.map(item => (
                  <tr key={item.id} className={item.status === "below" ? "ds-row-risk" : item.status === "over" ? "ds-row-over" : ""}>
                    <td>{item.name}</td>
                    <td>{item.category}</td>
                    <td>{item.storageArea}</td>
                    <td>{item.onHand}</td>
                    <td>{item.parLevel}</td>
                    <td className={item.difference < 0 ? "status-below" : item.difference > 0 ? "status-over" : ""}>{item.difference > 0 ? "+" : ""}{item.difference}</td>
                    <td>{item.avgDailyUsage}</td>
                    <td>{item.daysOnHand}</td>
                    <td className={item.status === "below" ? "status-below" : item.status === "over" ? "status-over" : ""}>
                      {item.status === "below" ? "Below Par" : item.status === "over" ? "Over Par" : "OK"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="action-buttons">
            <button className="btn btn-secondary">Export Inventory Snapshot</button>
            <button className="btn btn-secondary">Print Count Sheets</button>
            <button className="btn btn-secondary">Schedule Next Count</button>
            <button className="btn btn-primary">Create Transfer</button>
          </div>
        </div>
      </div>
      <ChatBot />
    </div>
  );
}

