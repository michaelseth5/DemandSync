"""Persisted source transactions and experiment metadata."""
from datetime import datetime
from sqlalchemy import String, Integer, Date, Float, DateTime, ForeignKey, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base

class SaleTransaction(Base):
    __tablename__ = "sales_transactions"
    id: Mapped[int] = mapped_column(primary_key=True)
    external_id: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    sku: Mapped[str] = mapped_column(String(64), index=True)
    sold_on: Mapped[Date] = mapped_column(Date, index=True)
    quantity: Mapped[int] = mapped_column(Integer)
    unit_price: Mapped[float] = mapped_column(Float)
    source: Mapped[str] = mapped_column(String(60), default="api")
    ingested_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

class DataQualityIssue(Base):
    __tablename__ = "transaction_quality_issues"
    id: Mapped[int] = mapped_column(primary_key=True)
    batch_id: Mapped[str] = mapped_column(String(40), index=True)
    external_id: Mapped[str | None] = mapped_column(String(100))
    reason: Mapped[str] = mapped_column(String(120))
    detected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

class DemandModelRun(Base):
    __tablename__ = "demand_model_runs"
    id: Mapped[int] = mapped_column(primary_key=True)
    sku: Mapped[str] = mapped_column(String(64), index=True)
    version: Mapped[str] = mapped_column(String(100), unique=True)
    trained_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    train_rows: Mapped[int] = mapped_column(Integer)
    test_rows: Mapped[int] = mapped_column(Integer)
    mape: Mapped[float | None] = mapped_column(Float)
    mae: Mapped[float] = mapped_column(Float)
    drift_mae: Mapped[float | None] = mapped_column(Float)
    artifact_path: Mapped[str] = mapped_column(String(500))
