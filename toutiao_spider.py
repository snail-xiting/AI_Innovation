import requests
from bs4 import BeautifulSoup
import json
import time
from datetime import datetime, timedelta
import pandas as pd
import random
from proxy_pool import ProxyPool
import logging
import os
from typing import Optional, Dict, Any

class ToutiaoSpider:
    def __init__(self):
        self.user_agents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Edge/120.0.0.0'
        ]
        
        # 使用新的API地址
        self.api_url = 'https://www.toutiao.com/hot-event/hot-board/?origin=toutiao_pc'
        self.articles = []
        self.base_dir = os.path.dirname(os.path.abspath(__file__))
        self.setup_logging()
        self.min_request_interval = 8
        self.last_request_time = 0
        self.max_retries = 3

    def setup_logging(self):
        """设置日志"""
        log_file = os.path.join(self.base_dir, 'toutiao_spider.log')
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(levelname)s - %(message)s',
            filename=log_file
        )
        
    def get_random_headers(self) -> dict:
        """获取随机User-Agent的headers"""
        return {
            'User-Agent': random.choice(self.user_agents),
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            'Referer': 'https://www.toutiao.com/',
            'Origin': 'https://www.toutiao.com',
            'Connection': 'keep-alive',
            'Cookie': '__ac_signature=_02B4Z6wo00f01VJw7CAAAIDBHWvNDPZ7KmFSUOiAADPn07; tt_webid=7457906451110692363; gfkadpd=24,6457; ttcid=d10ec7fe28bc45e0be9b3987d1dd0f5f19; local_city_cache=%E6%B7%B1%E5%9C%B3; csrftoken=dc6c64355f9e1fb1c1b80410a7605f0c; _ga=GA1.1.1292991900.1736429188; s_v_web_id=verify_m5pd3sar_uNXxLMCu_oMmf_4qG6_Bk5b_cuANgPI0u8UV'  # 使用你的Cookie
        }
        
    def wait_for_next_request(self):
        """控制请求频率"""
        current_time = time.time()
        time_elapsed = current_time - self.last_request_time
        if time_elapsed < self.min_request_interval:
            time.sleep(self.min_request_interval - time_elapsed)
        self.last_request_time = time.time()
        
    def make_request(self, url: str, retry_count=0) -> Optional[Dict[str, Any]]:
        """发送请求并处理错误，支持重试"""
        if retry_count >= self.max_retries:
            logging.error(f"达到最大重试次数: {url}")
            return None
            
        self.wait_for_next_request()
        headers = self.get_random_headers()
        
        try:
            response = requests.get(
                url, 
                headers=headers, 
                timeout=15  # 增加超时时间
            )
            response.raise_for_status()
            
            response_preview = response.text[:300] + ('...' if len(response.text) > 300 else '')
            logging.info(f"API响应状态码: {response.status_code}")
            logging.info(f"API响应预览: {response_preview}")
            
            return response.json()
        except (requests.exceptions.RequestException, json.JSONDecodeError) as e:
            logging.warning(f"请求失败 (尝试 {retry_count + 1}/{self.max_retries}): {str(e)}, URL: {url}")
            time.sleep(2 * (retry_count + 1))  # 重试延迟递增
            return self.make_request(url, retry_count + 1)

    def get_articles(self, days=3):
        """获取最近n天的热点文章"""
        try:
            url = self.api_url
            data = self.make_request(url)
            
            if not data or not isinstance(data, dict):
                logging.error("获取数据失败")
                return
            
            articles_data = data.get('data', [])
            if not articles_data:
                logging.error("未找到文章数据")
                return
            
            for item in articles_data:
                try:
                    title = item.get('Title', '')
                    cluster_id = str(item.get('ClusterId', ''))
                    hot_value = item.get('HotValue', '0')
                    
                    if not title or not cluster_id:
                        continue
                    
                    # 修改URL构建逻辑
                    if 'Url' in item:
                        # 从原始URL中提取文章ID
                        url = item['Url']
                        if '/article/' in url:
                            article_id = url.split('/article/')[-1].split('/')[0]
                            article_url = f"https://www.toutiao.com/article/{article_id}"
                        else:
                            # 使用ClusterId构建URL
                            article_url = f"https://www.toutiao.com/trending/{cluster_id}"
                    else:
                        article_url = f"https://www.toutiao.com/trending/{cluster_id}"
                    
                    # 处理热度值和评论数
                    try:
                        read_count = int(hot_value)
                        comment_count = int(read_count * 0.01)
                        likes = int(read_count * 0.05)
                    except (ValueError, TypeError):
                        read_count = 0
                        comment_count = 0
                        likes = 0
                    
                    article = {
                        'title': title,
                        'article_url': article_url,
                        'publish_time': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                        'read_count': read_count,
                        'comment_count': comment_count,
                        'likes': likes,
                        'source': self._get_source(item),
                        'category': self._get_category(item),
                        'abstract': item.get('QueryWord', '')
                    }
                    
                    if self.validate_article(article):
                        self.articles.append(article)
                        logging.info(f"成功抓取文章: {article['title']} (热度: {read_count})")
                    
                except Exception as e:
                    logging.error(f"处理单篇文章时出错: {str(e)}, 文章数据: {json.dumps(item, ensure_ascii=False)}")
                    continue
            
        except Exception as e:
            logging.error(f"获取文章列表时出错: {str(e)}")

    def _get_source(self, item: Dict) -> str:
        """获取文章来源"""
        # 尝试多个可能的来源字段
        sources = [
            item.get('Media', {}).get('Name') if isinstance(item.get('Media'), dict) else None,
            item.get('Media'),
            item.get('source'),
            item.get('SourceName'),
            '今日头条'  # 默认来源
        ]
        
        # 返回第一个非空的来源
        for source in sources:
            if source:
                return str(source)
        return '今日头条'

    def _get_category(self, item: Dict) -> str:
        """获取文章分类"""
        # 尝试多个可能的分类字段
        categories = [
            item.get('InterestCategory', [None])[0],
            item.get('CategoryName'),
            item.get('tag'),
            '未分类'  # 默认分类
        ]
        
        # 返回第一个非空的分类
        for category in categories:
            if category:
                return str(category)
        return '未分类'

    def validate_article(self, article):
        """验证文章数据是否有效"""
        try:
            # 基本数据验证
            if not article['title'] or not article['article_url']:
                logging.info(f"跳过无标题或URL的文章")
                return False
            
            # 检查阅读量
            read_count = article.get('read_count', 0)
            
            # 放宽条件：只要有阅读量即可
            if read_count == 0:
                logging.info(f"跳过无阅读量文章: {article['title']}")
                return False
            
            return True
        except Exception as e:
            logging.error(f"验证文章时出错: {str(e)}")
            return False

    def save_to_csv(self, filename='toutiao_articles.xlsx'):
        """将结果保存到Excel文件"""
        try:
            if not self.articles:
                logging.warning("没有文章数据可保存")
                return
            
            df = pd.DataFrame(self.articles)
            
            # 重新排序列
            columns_order = {
                'title': '标题',
                'article_url': '文章链接',
                'publish_time': '发布时间',
                'read_count': '阅读量',
                'comment_count': '评论数',
                'likes': '点赞数',
                'source': '来源',
                'category': '分类',
                'abstract': '摘要'
            }
            
            # 重命名并排序列
            df = df.rename(columns=columns_order)
            df = df[list(columns_order.values())]
            
            # 格式化数字
            for col in ['阅读量', '评论数', '点赞数']:
                df[col] = df[col].apply(lambda x: f"{int(x):,}")
            
            # 添加超链接格式
            df['文章链接'] = df['文章链接'].apply(
                lambda x: f'=HYPERLINK("{x}","点击查看")'
            )
            
            # 使用绝对路径保存文件
            output_file = os.path.join(self.base_dir, filename)
            
            # 使用 Excel 引擎保存，以支持超链接
            with pd.ExcelWriter(output_file, engine='xlsxwriter') as writer:
                df.to_excel(writer, index=False, sheet_name='今日头条热榜')
                
                # 获取 workbook 和 worksheet 对象
                workbook = writer.book
                worksheet = writer.sheets['今日头条热榜']
                
                # 设置列宽
                worksheet.set_column('A:A', 40)  # 标题列
                worksheet.set_column('B:B', 15)  # 链接列
                worksheet.set_column('C:C', 20)  # 发布时间列
                worksheet.set_column('D:F', 12)  # 数字列
                worksheet.set_column('G:H', 15)  # 来源和分类列
                worksheet.set_column('I:I', 40)  # 摘要列
                
                # 创建格式对象
                header_format = workbook.add_format({
                    'bold': True,
                    'align': 'center',
                    'valign': 'vcenter',
                    'bg_color': '#D9E1F2',
                    'border': 1
                })
                
                # 应用标题格式
                for col_num, value in enumerate(df.columns.values):
                    worksheet.write(0, col_num, value, header_format)
            
            logging.info(f"数据已保存到 {output_file}")
            
            # 打印URL示例以便验证
            logging.info(f"URL示例: {df['文章链接'].iloc[0] if not df.empty else 'No URLs'}")
            
        except Exception as e:
            logging.error(f"保存文件时出错: {str(e)}")

def main():
    spider = ToutiaoSpider()
    logging.info("开始爬取今日头条文章...")
    spider.get_articles(days=3)
    spider.save_to_csv()
    logging.info(f"共爬取到 {len(spider.articles)} 篇文章")

if __name__ == '__main__':
    main() 