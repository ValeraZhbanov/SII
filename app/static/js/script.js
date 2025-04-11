document.addEventListener('DOMContentLoaded', function () {
    // Инициализация элементов
    const startDateInput = document.getElementById('startDate');
    const endDateInput = document.getElementById('endDate');
    const eventTypeSelect = document.getElementById('eventType');
    const teacherSelect = document.getElementById('teacher');
    const buildingSelect = document.getElementById('building');
    const applyFiltersBtn = document.getElementById('applyFilters');

    let eventTypeChart, teacherChart, buildingChart;
    let dataTable;

    // Загрузка данных и инициализация
    async function initDashboard() {
        try {
            // Загрузка статистики для фильтров и графиков
            const statsResponse = await fetch('/api/stats');
            const stats = await statsResponse.json();

            // Заполнение фильтров
            populateFilter(eventTypeSelect, stats.event_stats, 'type');
            populateFilter(teacherSelect, stats.teacher_stats, 'teacher');
            populateFilter(buildingSelect, stats.building_stats, 'building');

            // Инициализация графиков
            initCharts(stats);

            // Инициализация таблицы
            initDataTable();

            // Загрузка данных с фильтрами по умолчанию
            loadData();
        } catch (error) {
            console.error('Ошибка инициализации:', error);
        }
    }

    // Заполнение фильтров
    function populateFilter(selectElement, data, key) {
        data.forEach(item => {
            const option = document.createElement('option');
            option.value = item[key];
            option.textContent = item[key] || 'Не указано';
            selectElement.appendChild(option);
        });
    }

    // Инициализация графиков
    function initCharts(stats) {
        const ctx1 = document.getElementById('eventTypeChart').getContext('2d');
        eventTypeChart = new Chart(ctx1, {
            type: 'pie',
            data: {
                labels: stats.event_stats.map(item => item.type),
                datasets: [{
                    data: stats.event_stats.map(item => item.count),
                    backgroundColor: [
                        'rgba(255, 99, 132, 0.7)',
                        'rgba(54, 162, 235, 0.7)',
                        'rgba(255, 206, 86, 0.7)',
                        'rgba(75, 192, 192, 0.7)',
                        'rgba(153, 102, 255, 0.7)',
                        'rgba(255, 159, 64, 0.7)'
                    ]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                    }
                }
            }
        });

        const ctx2 = document.getElementById('teacherChart').getContext('2d');
        teacherChart = new Chart(ctx2, {
            type: 'bar',
            data: {
                labels: stats.teacher_stats.map(item => item.teacher || 'Не указано'),
                datasets: [{
                    label: 'Количество мероприятий',
                    data: stats.teacher_stats.map(item => item.count),
                    backgroundColor: 'rgba(54, 162, 235, 0.7)'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });

        const ctx3 = document.getElementById('buildingChart').getContext('2d');
        buildingChart = new Chart(ctx3, {
            type: 'bar',
            data: {
                labels: stats.building_stats.map(item => item.building || 'Не указано'),
                datasets: [{
                    label: 'Количество мероприятий',
                    data: stats.building_stats.map(item => item.count),
                    backgroundColor: 'rgba(75, 192, 192, 0.7)'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }

    // Инициализация таблицы данных
    function initDataTable() {
        dataTable = $('#dataTable').DataTable({
            processing: true,
            serverSide: true,
            dom: 'lrtip',
            searching: false,
            ajax: {
                url: '/api/data',
                type: 'GET',
                data: function (d) {
                    // Добавляем параметры DataTables к нашим фильтрам
                    return {
                        ...getFilters(),
                        page: Math.ceil(d.start / d.length) + 1,
                        per_page: d.length,
                        draw: d.draw,
                        order_column: d.order[0]?.column,
                        order_dir: d.order[0]?.dir
                    };
                },
                dataSrc: function (json) {
                    json.recordsTotal = json.total;
                    json.recordsFiltered = json.total;
                    return json.data;
                }
            },
            columns: [
                {data: 'Дата', render: formatDate},
                {data: null, render: formatTime},
                {data: 'Мероприятие'},
                {data: 'КатегорияВремени'},
                {data: 'УчебнаяГруппа'},
                {data: 'Аудитория'},
                {data: 'Корпус'},
                {data: 'ФИО_полн'}
            ],
            language: {
                url: 'https://cdn.datatables.net/plug-ins/1.11.5/i18n/ru.json'
            },
            pageLength: 10,
            lengthMenu: [10, 25, 50, 100]
        });
    }

    function getFilters() {
        return {
            start_date: document.getElementById('startDate').value,
            end_date: document.getElementById('endDate').value,
            event_type: document.getElementById('eventType').value,
            teacher: document.getElementById('teacher').value,
            building: document.getElementById('building').value
        };
    }

    // При изменении фильтров перезагружаем таблицу
    document.getElementById('applyFilters').addEventListener('click', function () {
        dataTable.ajax.reload();
    });

    // Форматирование даты
    function formatDate(date) {
        if (!date) return '';
        const d = new Date(date);
        return d.toLocaleDateString('ru-RU');
    }

    // Форматирование времени
    function formatTime(row) {
        return `${row.ВремяНачала} - ${row.ВремяОкончания}`;
    }

    // Загрузка данных с фильтрами
    async function loadData() {
        try {
            const params = new URLSearchParams();

            if (startDateInput.value) params.append('start_date', startDateInput.value);
            if (endDateInput.value) params.append('end_date', endDateInput.value);
            if (eventTypeSelect.value !== 'all') params.append('event_type', eventTypeSelect.value);
            if (teacherSelect.value !== 'all') params.append('teacher', teacherSelect.value);
            if (buildingSelect.value !== 'all') params.append('building', buildingSelect.value);

            const response = await fetch(`/api/data?${params.toString()}`);
            const data = await response.json();

            // Обновление таблицы
            dataTable.clear().rows.add(data).draw();

            // Обновление графиков
            updateCharts(data);
        } catch (error) {
            console.error('Ошибка загрузки данных:', error);
        }
    }

    // Обновление графиков
    function updateCharts(data) {
        // Группировка данных для графиков
        const eventTypes = {};
        const teachers = {};
        const buildings = {};

        data.forEach(item => {
            // Типы мероприятий
            const eventType = item.КатегорияВремени || 'Не указано';
            eventTypes[eventType] = (eventTypes[eventType] || 0) + 1;

            // Преподаватели
            const teacher = item.ФИО_полн || 'Не указано';
            teachers[teacher] = (teachers[teacher] || 0) + 1;

            // Корпуса
            const building = item.Корпус || 'Не указано';
            buildings[building] = (buildings[building] || 0) + 1;
        });

        // Обновление графиков
        updateChart(eventTypeChart, eventTypes);
        updateChart(teacherChart, teachers);
        updateChart(buildingChart, buildings);
    }

    // Обновление конкретного графика
    function updateChart(chart, newData) {
        const labels = Object.keys(newData);
        const data = Object.values(newData);

        chart.data.labels = labels;
        chart.data.datasets.forEach(dataset => {
            dataset.data = data;
        });

        chart.update();
    }

    // Обработчик применения фильтров
    applyFiltersBtn.addEventListener('click', loadData);

    // Инициализация дашборда
    initDashboard();
});