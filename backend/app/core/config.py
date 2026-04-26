from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # App info
    APP_NAME: str = "CoreMD Backend"

    # Database connections
    MONGO_URI: str
    REDIS_URL: str

    # Security
    JWT_SECRET: str
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRES_MINUTES: int = 60

    # LLM / AI keys
    OPENAI_API_KEY: str | None = None

    class Config:
        env_file = ".env"  # Load from local .env file by default


# Create a global settings instance
settings = Settings()
