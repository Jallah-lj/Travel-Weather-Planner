import uuid
from datetime import date, datetime, timezone
from typing import Any
from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Integer, JSON, String, Text, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base

def utcnow() -> datetime:
    return datetime.now(timezone.utc)

class UUIDTimestampMixin:
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

class User(UUIDTimestampMixin, Base):
    __tablename__ = "users"
    supabase_subject: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True, unique=True)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    profile: Mapped["Profile | None"] = relationship(back_populates="user", cascade="all, delete-orphan", uselist=False)
    trips: Mapped[list["Trip"]] = relationship(back_populates="user", cascade="all, delete-orphan")

class Profile(UUIDTimestampMixin, Base):
    __tablename__ = "profiles"
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    display_name: Mapped[str] = mapped_column(String(120), default="Traveler")
    temperature_unit: Mapped[str] = mapped_column(String(4), default="C")
    distance_unit: Mapped[str] = mapped_column(String(8), default="km")
    timezone: Mapped[str] = mapped_column(String(64), default="UTC")
    travel_preferences: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    notification_preferences: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    user: Mapped[User] = relationship(back_populates="profile")

class Destination(UUIDTimestampMixin, Base):
    __tablename__ = "destinations"
    slug: Mapped[str] = mapped_column(String(160), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(120), index=True)
    country: Mapped[str] = mapped_column(String(120), index=True)
    country_code: Mapped[str] = mapped_column(String(2))
    flag: Mapped[str] = mapped_column(String(8))
    timezone: Mapped[str] = mapped_column(String(64))
    latitude: Mapped[float] = mapped_column(Float)
    longitude: Mapped[float] = mapped_column(Float)
    destination_type: Mapped[str] = mapped_column(String(32), default="city")

class Trip(UUIDTimestampMixin, Base):
    __tablename__ = "trips"
    user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    title: Mapped[str] = mapped_column(String(180))
    departure_date: Mapped[date] = mapped_column(Date)
    return_date: Mapped[date] = mapped_column(Date)
    travel_style: Mapped[str] = mapped_column(String(32), default="relaxed")
    activities: Mapped[list[str]] = mapped_column(JSON, default=list)
    status: Mapped[str] = mapped_column(String(24), default="planned")
    user: Mapped[User | None] = relationship(back_populates="trips")
    destinations: Mapped[list["TripDestination"]] = relationship(back_populates="trip", cascade="all, delete-orphan")
    itineraries: Mapped[list["Itinerary"]] = relationship(back_populates="trip", cascade="all, delete-orphan")
    packing_lists: Mapped[list["PackingList"]] = relationship(back_populates="trip", cascade="all, delete-orphan")

class TripDestination(UUIDTimestampMixin, Base):
    __tablename__ = "trip_destinations"
    trip_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("trips.id", ondelete="CASCADE"), index=True)
    destination_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("destinations.id"), index=True)
    arrival_date: Mapped[date] = mapped_column(Date)
    departure_date: Mapped[date] = mapped_column(Date)
    position: Mapped[int] = mapped_column(Integer, default=0)
    trip: Mapped[Trip] = relationship(back_populates="destinations")
    destination: Mapped[Destination] = relationship()

class WeatherSnapshot(UUIDTimestampMixin, Base):
    __tablename__ = "weather_snapshots"
    destination_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("destinations.id"), index=True)
    provider: Mapped[str] = mapped_column(String(32))
    observed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    payload: Mapped[dict[str, Any]] = mapped_column(JSON)

class WeatherForecast(UUIDTimestampMixin, Base):
    __tablename__ = "weather_forecasts"
    destination_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("destinations.id"), index=True)
    provider: Mapped[str] = mapped_column(String(32))
    forecast_for: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    issued_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    payload: Mapped[dict[str, Any]] = mapped_column(JSON)

class Activity(UUIDTimestampMixin, Base):
    __tablename__ = "activities"
    slug: Mapped[str] = mapped_column(String(80), unique=True)
    name: Mapped[str] = mapped_column(String(120))
    weather_profile: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)

class Itinerary(UUIDTimestampMixin, Base):
    __tablename__ = "itineraries"
    trip_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("trips.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(160), default="My itinerary")
    trip: Mapped[Trip] = relationship(back_populates="itineraries")
    items: Mapped[list["ItineraryItem"]] = relationship(back_populates="itinerary", cascade="all, delete-orphan")

class ItineraryItem(UUIDTimestampMixin, Base):
    __tablename__ = "itinerary_items"
    itinerary_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("itineraries.id", ondelete="CASCADE"), index=True)
    activity_date: Mapped[date] = mapped_column(Date)
    start_time: Mapped[str] = mapped_column(String(5))
    end_time: Mapped[str | None] = mapped_column(String(5), nullable=True)
    title: Mapped[str] = mapped_column(String(180))
    category: Mapped[str] = mapped_column(String(64))
    position: Mapped[int] = mapped_column(Integer, default=0)
    weather_context: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    itinerary: Mapped[Itinerary] = relationship(back_populates="items")

class PackingList(UUIDTimestampMixin, Base):
    __tablename__ = "packing_lists"
    trip_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("trips.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(160), default="Smart packing list")
    trip: Mapped[Trip] = relationship(back_populates="packing_lists")
    items: Mapped[list["PackingItem"]] = relationship(back_populates="packing_list", cascade="all, delete-orphan")

class PackingItem(UUIDTimestampMixin, Base):
    __tablename__ = "packing_items"
    packing_list_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("packing_lists.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(180))
    category: Mapped[str] = mapped_column(String(80))
    quantity: Mapped[int] = mapped_column(Integer, default=1)
    packed: Mapped[bool] = mapped_column(Boolean, default=False)
    reason: Mapped[str | None] = mapped_column(String(255), nullable=True)
    packing_list: Mapped[PackingList] = relationship(back_populates="items")

class WeatherAlert(UUIDTimestampMixin, Base):
    __tablename__ = "weather_alerts"
    trip_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("trips.id", ondelete="CASCADE"), index=True)
    severity: Mapped[str] = mapped_column(String(20))
    title: Mapped[str] = mapped_column(String(180))
    description: Mapped[str] = mapped_column(Text)
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    acknowledged_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

class Notification(UUIDTimestampMixin, Base):
    __tablename__ = "notifications"
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    channel: Mapped[str] = mapped_column(String(20))
    title: Mapped[str] = mapped_column(String(180))
    body: Mapped[str] = mapped_column(Text)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    payload: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)

class SavedDestination(UUIDTimestampMixin, Base):
    __tablename__ = "saved_destinations"
    __table_args__ = (UniqueConstraint("user_id", "destination_id"),)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    destination_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("destinations.id", ondelete="CASCADE"), index=True)

class SearchHistory(UUIDTimestampMixin, Base):
    __tablename__ = "search_history"
    user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    query: Mapped[str] = mapped_column(String(255))
    destination_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("destinations.id"), nullable=True)

class AIConversation(UUIDTimestampMixin, Base):
    __tablename__ = "ai_conversations"
    user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    trip_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("trips.id", ondelete="CASCADE"), nullable=True, index=True)
    title: Mapped[str] = mapped_column(String(180), default="Travel assistant")
    messages: Mapped[list["AIMessage"]] = relationship(back_populates="conversation", cascade="all, delete-orphan")

class AIMessage(UUIDTimestampMixin, Base):
    __tablename__ = "ai_messages"
    conversation_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("ai_conversations.id", ondelete="CASCADE"), index=True)
    role: Mapped[str] = mapped_column(String(16))
    content: Mapped[str] = mapped_column(Text)
    structured_data: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    conversation: Mapped[AIConversation] = relationship(back_populates="messages")

class AuditLog(UUIDTimestampMixin, Base):
    __tablename__ = "audit_logs"
    user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    action: Mapped[str] = mapped_column(String(80), index=True)
    resource_type: Mapped[str] = mapped_column(String(80))
    resource_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    request_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    metadata_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)

class TripPlan(Base):
    __tablename__ = "trip_plans"
    trip_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("trips.id", ondelete="CASCADE"), primary_key=True)
    itinerary: Mapped[list] = mapped_column(JSON, default=list)
    packing: Mapped[list] = mapped_column(JSON, default=list)
    revision: Mapped[int] = mapped_column(Integer, default=1)

class TripShare(UUIDTimestampMixin, Base):
    __tablename__ = 'trip_shares'
    trip_id: Mapped[uuid.UUID] = mapped_column(ForeignKey('trips.id', ondelete='CASCADE'), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    permission: Mapped[str] = mapped_column(String(8))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
