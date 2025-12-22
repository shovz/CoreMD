from fastapi import APIRouter

from app.db.mongo import get_db

router = APIRouter(prefix="/debug", tags=["debug"])


@router.get("/mongo-ping")
def mongo_ping():
    print("Pinging MongoDB...")
    db = get_db()
    print(f"Database object: {db}")
    print(f"Database name: {db.name}")
    # "ping" checks if MongoDB responds
    try:
        # Use the database command method
        result = db.command("ping")
        print(f"Ping result: {result}")
        return {"mongo": "ok", "database": db.name, "result": result}
    except AttributeError as e:
        # If command doesn't exist, try via client
        try:
            result = db.client.admin.command("ping")
            return {"mongo": "ok via client", "database": db.name, "result": result}
        except Exception as e2:
            return {"mongo": "error", "message": str(e2)}
    except Exception as e:
        return {"mongo": "error", "message": str(e)}
