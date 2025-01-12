# 今日头条新闻爬虫

这是一个用于爬取今日头条热门新闻的Python爬虫项目。

## 项目结构
```
.
├── toutiao_spider.py    # 主爬虫程序
├── proxy_pool.py        # 代理池管理
├── requirements.txt     # 项目依赖
└── README.md           # 项目说明
```

## 环境要求
- Python 3.6+
- pip（Python包管理器）

## 安装步骤
1. 克隆或下载本项目到任意目录
2. 在项目目录下打开命令行，运行以下命令安装依赖：
   ```
   pip install -r requirements.txt
   ```

## 使用方法
1. 在项目目录下运行主程序：
   ```
   python toutiao_spider.py
   ```
2. 程序会自动爬取今日头条的热门新闻，并将结果保存到Excel文件中
3. 运行日志会保存在`toutiao_spider.log`文件中

## 输出文件
- `toutiao_articles.xlsx`: 爬取的新闻数据
- `toutiao_spider.log`: 运行日志

## 注意事项
- 请确保运行时有稳定的网络连接
- 建议使用代理池以避免被封IP
- 遵守网站的robots协议和使用规范 