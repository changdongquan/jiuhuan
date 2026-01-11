#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
删除xlsx文件中指定位置的图片
"""
import zipfile
import xml.etree.ElementTree as ET
import os
import shutil

def get_column_number(column_letter):
    """将列字母转换为数字（A=1, B=2, ...）"""
    result = 0
    for char in column_letter.upper():
        result = result * 26 + (ord(char) - ord('A') + 1)
    return result

def delete_image_from_xlsx(xlsx_path, target_col_letter, target_row_start, target_row_end):
    """从xlsx文件中删除指定位置的图片"""
    target_col_num = get_column_number(target_col_letter)
    
    try:
        # 创建临时目录
        temp_dir = "/tmp/excel_delete_img"
        if os.path.exists(temp_dir):
            shutil.rmtree(temp_dir)
        os.makedirs(temp_dir)
        
        # 解压xlsx文件
        with zipfile.ZipFile(xlsx_path, 'r') as zip_ref:
            zip_ref.extractall(temp_dir)
        
        # 查找drawing文件
        drawing_files = []
        for root, dirs, files in os.walk(temp_dir):
            for file in files:
                if 'xl/drawings/drawing' in os.path.join(root, file) and file.endswith('.xml'):
                    rel_path = os.path.relpath(os.path.join(root, file), temp_dir)
                    drawing_files.append(rel_path)
        
        if not drawing_files:
            print("未找到drawing文件")
            return False
        
        found = False
        for drawing_path in drawing_files:
            drawing_file = os.path.join(temp_dir, drawing_path)
            
            # 解析XML
            tree = ET.parse(drawing_file)
            root = tree.getroot()
            
            # 命名空间
            namespaces = {
                'xdr': 'http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing',
                'a': 'http://schemas.openxmlformats.org/drawingml/2006/main',
                'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
            }
            
            # 查找并删除匹配的图片
            for anchor in list(root.findall('.//xdr:twoCellAnchor', namespaces)):
                from_elem = anchor.find('.//xdr:from', namespaces)
                if from_elem is not None:
                    col_elem = from_elem.find('xdr:col', namespaces)
                    row_elem = from_elem.find('xdr:row', namespaces)
                    
                    if col_elem is not None and row_elem is not None:
                        col = int(col_elem.text)
                        row = int(row_elem.text)
                        
                        # Excel内部从0开始计数
                        if col == (target_col_num - 1) and row == (target_row_start - 1):
                            root.remove(anchor)
                            found = True
                            print(f"找到并删除: 列{target_col_letter}行{target_row_start}")
            
            # 检查oneCellAnchor
            for anchor in list(root.findall('.//xdr:oneCellAnchor', namespaces)):
                from_elem = anchor.find('.//xdr:from', namespaces)
                if from_elem is not None:
                    col_elem = from_elem.find('xdr:col', namespaces)
                    row_elem = from_elem.find('xdr:row', namespaces)
                    
                    if col_elem is not None and row_elem is not None:
                        col = int(col_elem.text)
                        row = int(row_elem.text)
                        
                        if col == (target_col_num - 1) and row == (target_row_start - 1):
                            root.remove(anchor)
                            found = True
                            print(f"找到并删除: 列{target_col_letter}行{target_row_start}")
            
            if found:
                # 保存修改后的XML
                tree.write(drawing_file, encoding='utf-8', xml_declaration=True)
                print(f"已更新drawing文件: {drawing_path}")
        
        if not found:
            print(f"未找到列{target_col_letter}行{target_row_start}-{target_row_end}的图片")
            shutil.rmtree(temp_dir)
            return False
        
        # 重新打包xlsx文件
        backup_file = xlsx_path + '.bak'
        shutil.copy2(xlsx_path, backup_file)
        print(f"已创建备份文件: {backup_file}")
        
        with zipfile.ZipFile(xlsx_path, 'w', zipfile.ZIP_DEFLATED) as new_zip:
            for root, dirs, files in os.walk(temp_dir):
                for file in files:
                    file_path = os.path.join(root, file)
                    arcname = os.path.relpath(file_path, temp_dir)
                    new_zip.write(file_path, arcname)
        
        # 清理临时目录
        shutil.rmtree(temp_dir)
        
        print(f"✓ 成功删除图片并更新文件: {xlsx_path}")
        return True
        
    except Exception as e:
        print(f"错误: {e}")
        import traceback
        traceback.print_exc()
        if os.path.exists(temp_dir):
            shutil.rmtree(temp_dir)
        return False

if __name__ == "__main__":
    xlsx_file = "/Users/changun/Documents/新开模具清单.xlsx"
    target_col = "B"
    target_row_start = 24
    target_row_end = 25
    
    print(f"查找并删除图片：列{target_col}，行{target_row_start}-{target_row_end}")
    print("=" * 60)
    
    if delete_image_from_xlsx(xlsx_file, target_col, target_row_start, target_row_end):
        print("\n✓ 删除成功！")
    else:
        print("\n✗ 删除失败或未找到图片")

