# AI 制作的 AE CEP 脚本
它的主要功能是提供一个可视化的界面来管理和运行After Effects脚本，让用户能够更方便地组织、搜索和执行各种AE脚本。
可以在此直接下载也可以去这个网址下载：https://nocode.host/aj9p9x
## 核心功能
1. 脚本管理
文件夹选择：用户可以选择包含AE脚本（.jsx, .jsxbin文件）的文件夹
脚本扫描：自动扫描指定文件夹中的所有脚本文件
脚本执行：点击即可运行选中的脚本
2. 分类系统
分类管理：用户可以创建自定义分类来组织脚本
分类筛选：通过侧边栏的分类列表快速筛选脚本
默认分类：包含"全部"分类，显示所有脚本
3. 搜索功能
实时搜索：输入关键词实时过滤脚本列表
清除搜索：一键清除搜索条件
搜索提示：提供搜索输入框的帮助提示
4. 标签系统
标签管理：为脚本添加自定义标签
标签筛选：通过激活标签来筛选相关脚本
标签编辑：支持添加、删除标签
5. 脚本设置
右键菜单：右键点击脚本可打开设置菜单
脚本配置：为每个脚本设置自定义属性
预览功能：支持脚本预览图片显示
6. 用户界面特性
响应式布局：支持面板大小调整
主题切换：支持明暗主题切换
大小调节：可调整脚本项显示大小
网格/列表视图：支持两种显示模式切换
7. 数据管理
设置保存：自动保存用户设置和偏好
导入导出：支持配置数据的导入导出
持久化存储：使用After Effects的设置系统保存数据
8. 高级功能
背景设置：支持自定义背景图片和视频
剪贴板导入：支持Ctrl+V导入剪贴板图片
图片保存位置：可配置图片保存到桌面、文档文件夹或项目文件同目录
## 技术架构
### 前端技术
HTML5：提供基础页面结构
CSS3：实现现代化的用户界面样式
JavaScript：处理用户交互和业务逻辑
CEP框架：与After Effects进行通信
### 后端技术
ExtendScript：与After Effects API交互
文件系统操作：扫描和管理脚本文件
设置管理：使用AE内置设置系统

## 使用场景
脚本开发者：管理和测试自己开发的AE脚本
视频制作师：快速访问常用的AE脚本工具
团队协作：统一管理团队共享的脚本库
工作流程优化：通过分类和标签提高脚本使用效率
## 优势特点
用户友好：直观的图形界面，无需记忆脚本路径
高度可定制：支持分类、标签、主题等多种自定义选项
性能优化：高效的脚本扫描和加载机制
稳定可靠：完善的错误处理和设置持久化
扩展性强：模块化设计，易于添加新功能
