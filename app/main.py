from fastapi import FastAPI, Request, Query
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
import pandas as pd
from datetime import datetime
import uvicorn
from typing import Optional
from pydantic import BaseModel
import os
from fastapi_cache import FastAPICache
from fastapi_cache.backends.redis import RedisBackend
from fastapi_cache.decorator import cache
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from redis import asyncio as aioredis

APP_ROOT_PATH =  os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    redis = aioredis.from_url("redis://localhost")
    FastAPICache.init(RedisBackend(redis), prefix="fastapi-cache")
    yield


app = FastAPI(lifespan=lifespan)

# Монтируем статические файлы
app.mount('/static', StaticFiles(directory=os.path.join(APP_ROOT_PATH, 'app', 'static')), name='static')

templates = Jinja2Templates(directory=os.path.join(APP_ROOT_PATH, 'app', 'templates'))

# Загрузка данных
df = pd.read_csv(os.path.join(APP_ROOT_PATH, 'app', 'data.csv'), encoding='utf-8', parse_dates=True, delimiter=';', na_values=['NULL', 'null', 'NaN', 'N/A', ''])
df = df.fillna(value='')

df['idx_КатегорияВремени'] = df['КатегорияВремени'].astype('category')
df['idx_ФИО_полн'] = df['ФИО_полн'].astype('category')
df['idx_Корпус'] = df['Корпус'].astype('category')

# Преобразование времени
df['ВремяНачала'] = pd.to_datetime(df['ВремяНачала'], format='%H:%M:%S').dt.time
df['ВремяОкончания'] = pd.to_datetime(df['ВремяОкончания'], format='%H:%M:%S').dt.time

# API endpoints
@app.get('/')
async def read_root(request: Request):
    return templates.TemplateResponse('index.html', {'request': request})


class PaginatedResponse(BaseModel):
    data: list[dict]
    total: int
    page: int
    per_page: int


@app.get('/api/data')
@cache(expire=300)
async def get_data(
    request: Request,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    event_type: Optional[str] = None,
    teacher: Optional[str] = None,
    building: Optional[str] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(10, ge=1, le=100),
    draw: Optional[int] = None 
):
    filtered_df = df

    # Фильтрация по дате с использованием индекса
    if start_date or end_date:
        date_slice = slice(
            pd.to_datetime(start_date) if start_date else None,
            pd.to_datetime(end_date) if end_date else None
        )
        filtered_df = filtered_df.loc[date_slice, :]
    
    # Фильтрация по другим полям с использованием индексов
    if event_type and event_type != 'all':
        filtered_df = filtered_df[filtered_df['idx_КатегорияВремени'] == event_type]
    
    if teacher and teacher != 'all':
        filtered_df = filtered_df[filtered_df['idx_ФИО_полн'] == teacher]
    
    if building and building != 'all':
        filtered_df = filtered_df[filtered_df['idx_Корпус'] == building]

    order_column = request.query_params.get('order[0][column]')
    order_dir = request.query_params.get('order[0][dir]', 'asc')
    
    if order_column:
        column_name = request.query_params.get(f'columns[{order_column}][data]')
        if column_name in filtered_df.columns:
            filtered_df = filtered_df.sort_values(
                column_name,
                ascending=order_dir == 'asc'
            )
    
    # Пагинация
    total = len(filtered_df)
    offset = (page - 1) * per_page
    paginated_df = filtered_df.iloc[offset:offset + per_page]
    
    # Подготовка данных
    data = paginated_df.reset_index().to_dict(orient='records')
    
    return {
        "data": data,
        "total": total,
        "page": page,
        "per_page": per_page
    }


@app.get('/api/stats')
async def get_stats():
    # Статистика по типам мероприятий
    event_stats = df['КатегорияВремени'].value_counts().reset_index()
    event_stats.columns = ['type', 'count']
    
    # Статистика по преподавателям
    teacher_stats = df['ФИО_полн'].value_counts().reset_index()
    teacher_stats.columns = ['teacher', 'count']
    
    # Статистика по корпусам
    building_stats = df['Корпус'].value_counts().reset_index()
    building_stats.columns = ['building', 'count']
    
    return {
        'event_stats': event_stats.to_dict(orient='records'),
        'teacher_stats': teacher_stats.to_dict(orient='records'),
        'building_stats': building_stats.to_dict(orient='records')
    }

if __name__ == '__main__':
    uvicorn.run(app, host='0.0.0.0', port=8000)