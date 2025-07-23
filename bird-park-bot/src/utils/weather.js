const https = require('https');

class WeatherManager {
    constructor() {
        this.apiKey = process.env.WEATHER_API_KEY;
        this.location = process.env.WEATHER_LOCATION || 'Tokyo,JP';
        this.cache = null;
        this.cacheTime = null;
        this.cacheExpiry = 30 * 60 * 1000; // 30分キャッシュ
    }

    // 現在の天気を取得
    async getCurrentWeather() {
        try {
            // キャッシュチェック
            if (this.cache && this.cacheTime && (Date.now() - this.cacheTime) < this.cacheExpiry) {
                return this.cache;
            }

            const weatherData = await this.fetchWeatherData();
            
            // キャッシュ保存
            this.cache = weatherData;
            this.cacheTime = Date.now();
            
            return weatherData;
        } catch (error) {
            console.error('天気取得エラー:', error);
            return {
                condition: 'unknown',
                description: '天気情報取得不可',
                temperature: null
            };
        }
    }

    // APIから天気データ取得
    fetchWeatherData() {
        return new Promise((resolve, reject) => {
            if (!this.apiKey) {
                reject(new Error('WEATHER_API_KEY が設定されていません'));
                return;
            }

            const url = `https://api.openweathermap.org/data/2.5/weather?q=${this.location}&appid=${this.apiKey}&units=metric&lang=ja`;
            
            https.get(url, (res) => {
                let data = '';
                
                res.on('data', (chunk) => {
                    data += chunk;
                });
                
                res.on('end', () => {
                    try {
                        const weather = JSON.parse(data);
                        
                        if (weather.cod !== 200) {
                            reject(new Error(`API Error: ${weather.message}`));
                            return;
                        }

                        const condition = this.categorizeWeather(weather.weather[0].main, weather.weather[0].id);
                        
                        resolve({
                            condition: condition,
                            description: weather.weather[0].description,
                            temperature: Math.round(weather.main.temp),
                            humidity: weather.main.humidity,
                            windSpeed: weather.wind?.speed || 0
                        });
                    } catch (error) {
                        reject(error);
                    }
                });
            }).on('error', (error) => {
                reject(error);
            });
        });
    }

    // 天気を4つのカテゴリに分類
    categorizeWeather(main, id) {
        // OpenWeatherMap の条件IDに基づく分類
        if (id >= 200 && id < 300) return 'stormy';   // 雷雨
        if (id >= 300 && id < 600) return 'rainy';    // 雨・霧雨
        if (id >= 600 && id < 700) return 'snowy';    // 雪
        if (id >= 700 && id < 800) return 'foggy';    // 霧・もや
        if (id === 800) return 'sunny';               // 快晴
        if (id > 800) return 'cloudy';                // 曇り
        
        return 'unknown';
    }

    // 天気による鳥の行動傾向を取得
    getBirdBehavior(condition) {
        const behaviors = {
            sunny: {
                mood: 'active',
                description: '晴天で活発',
                activityBonus: 1.2
            },
            rainy: {
                mood: 'calm',
                description: '雨で静か',
                activityBonus: 0.8
            },
            cloudy: {
                mood: 'normal',
                description: '曇天で普通',
                activityBonus: 1.0
            },
            snowy: {
                mood: 'sleepy',
                description: '雪で眠そう',
                activityBonus: 0.7
            },
            stormy: {
                mood: 'hiding',
                description: '嵐で隠れている',
                activityBonus: 0.5
            },
            foggy: {
                mood: 'mysterious',
                description: '霧で神秘的',
                activityBonus: 0.9
            }
        };

        return behaviors[condition] || behaviors.cloudy;
    }

    // 天気絵文字を取得
    getWeatherEmoji(condition) {
        const emojis = {
            sunny: '☀️',
            rainy: '🌧️',
            cloudy: '☁️',
            snowy: '❄️',
            stormy: '⛈️',
            foggy: '🌫️',
            unknown: '❓'
        };

        return emojis[condition] || emojis.unknown;
    }
}

module.exports = new WeatherManager();
