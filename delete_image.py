#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
删除Excel文件中指定位置的图片
"""
import sys
import os
import zipfile
import xml.etree.ElementTree as ET
from openpyxl import load_workbook
import subprocess

def convert_xls_to_xlsx_with_libreoffice(xls_path, xlsx_path):
    """使用LibreOffice将.xls文件转换为.xlsx格式（保留图片）"""
    import subprocess
    import os
    
    try:
        libreoffice_paths = [
            'libreoffice',
            '/Applications/LibreOffice.app/Contents/MacOS/soffice'
        ]
        
        soffice = None
        for path in libreoffice_paths:
            if os.path.exists(path) or subprocess.run(['which', path.split('/')[-1]], 
                                                      capture_output=True).returncode == 0:
                soffice = path
                break
        
        if not soffice:
            print("未找到LibreOffice")
            return False
        
        output_dir = os.path.dirname(xlsx_path)
        input_file = os.path.abspath(xls_path)
        
        print(f"使用LibreOffice转换文件...")
        
        cmd = [
            soffice,
            '--headless',
            '--convert-to', 'xlsx',
            '--outdir', output_dir,
            input_file
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        
        if result.returncode == 0:
            expected_output = os.path.join(output_dir, 
                                          os.path.splitext(os.path.basename(xls_path))[0] + '.xlsx')
            if os.path.exists(expected_output):
                if expected_output != xlsx_path:
                    os.rename(expected_output, xlsx_path)
                print(f"✓ LibreOffice转换成功: {xlsx_path}")
                return True
        return False
            
    except Exception as e:
        print(f"转换错误: {e}")
        return False

def find_and_delete_image_by_position(xlsx_path, target_col, target_row_start, target_row_end):
    """查找并删除指定位置的图片"""
    try:
        # 打开xlsx文件（作为ZIP）
        with zipfile.ZipFile(xlsx_path, 'r') as zip_ref:
            # 查找drawing文件
            drawing_files = [f for f in zip_ref.namelist() if 'xl/drawings/drawing' in f and f.endswith('.xml')]
            if not drawing_files:
                print("未找到drawing文件")
                return False
            
            drawing_path = drawing_files[0]
            
            # 读取drawing XML
            with zip_ref.open(drawing_path) as f:
                tree = ET.parse(f)
                root = tree.getroot()
            
            # 解析命名空间
            namespaces = {
                'xdr': 'http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing',
                'a': 'http://schemas.openxmlformats.org/drawingml/2006/main',
                'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
            }
            
            # 查找匹配的图片
            found = False
            elements_to_remove = []
            
            for anchor in root.findall('.//xdr:twoCellAnchor', namespaces):
                from_elem = anchor.find('.//xdr:from', namespaces)
                if from_elem is not None:
                    col_elem = from_elem.find('xdr:col', namespaces)
                    row_elem = from_elem.find('xdr:row', namespaces)
                    
                    if col_elem is not None and row_elem is not None:
                        col = int(col_elem.text)
                        row = int(row_elem.text)
                        
                        # 检查是否匹配（Excel从0开始，openpyxl从1开始）
                        # target_col是Excel列号（A=1, B=2），需要减1
                        # target_row也需要减1
                        if col == (target_col - 1) and row == (target_row_start - 1):
                            elements_to_remove.append(anchor)
                            found = True
            
            # 也检查oneCellAnchor
            for anchor in root.findall('.//xdr:oneCellAnchor', namespaces):
                from_elem = anchor.find('.//xdr:from', namespaces)
                if from_elem is not None:
                    col_elem = from_elem.find('xdr:col', namespaces)
                    row_elem = from_elem.find('xdr:row', namespaces)
                    
                    if col_elem is not None and row_elem is not None:
                        col = int(col_elem.text)
                        row = int(row_elem.text)
                        
                        if col == (target_col - 1) and row == (target_row_start - 1):
                            elements_to_remove.append(anchor)
                            found = True
            
            if not found:
                print(f"未找到列{chr(64+target_col)}行{target_row_start}-{target_row_end}的图片")
                return False
            
            # 删除找到的元素
            for elem in elements_to_remove:
                root.remove(elem)
                print(f"找到并标记删除: 列{chr(64+target_col)}行{target_row_start}")
            
            # 保存修改后的XML
            # 需要重新打包ZIP文件
            temp_dir = "/tmp/excel_delete_img"
            os.makedirs(temp_dir, exist_ok=True)
            
            # 提取所有文件
            zip_ref.extractall(temp_dir)
            
            # 更新drawing XML
            tree.write(os.path.join(temp_dir, drawing_path), encoding='utf-8', xml_declaration=True)
            
            # 重新打包
            new_xlsx = xlsx_path + '.new'
            with zipfile.ZipFile(new_xlsx, 'w', zipfile.ZIP_DEFLATED) as new_zip:
                for root, dirs, files in os.walk(temp_dir):
                    for file in files:
                        file_path = os.path.join(root, file)
                        arcname = os.path.relpath(file_path, temp_dir)
                        new_zip.write(file_path, arcname)
            
            # 替换原文件
            os.rename(new_xlsx, xlsx_path)
            
            print(f"✓ 成功删除图片")
            return True
            
    except Exception as e:
        print(f"错误: {e}")
        import traceback
        traceback.print_exc()
        return False

def get_column_number(column_letter):
    """将列字母转换为数字（A=1, B=2, ...）"""
    result = 0
    for char in column_letter.upper():
        result = result * 26 + (ord(char) - ord('A') + 1)
    return result

if __name__ == "__main__":
    xls_file = "/Users/changun/Documents/新开模具清单.xls"
    xlsx_file = "/Users/changun/Documents/新开模具清单_temp.xlsx"
    
    # 目标图片：列B（列号2），行24-25
    target_col_letter = "B"
    target_col_num = get_column_number(target_col_letter)
    target_row_start = 24
    target_row_end = 25
    
    print(f"查找并删除图片：列{target_col_letter}，行{target_row_start}-{target_row_end}")
    print("=" * 60)
    
    # 如果xlsx文件不存在或需要更新，先转换
    if not os.path.exists(xlsx_file) or os.path.getmtime(xls_file) > os.path.getmtime(xlsx_file):
        if not convert_xls_to_xlsx_with_libreoffice(xls_file, xlsx_file):
            print("转换失败")
            sys.exit(1)
    
    # 删除图片
    if find_and_delete_image_by_position(xlsx_file, target_col_num, target_row_start, target_row_end):
        print("\n✓ 删除成功！")
        print("注意：修改的是转换后的.xlsx文件")
        print("如需更新原始.xls文件，请在Excel中打开.xlsx文件并另存为.xls格式")
    else:
        print("\n✗ 删除失败或未找到图片")

