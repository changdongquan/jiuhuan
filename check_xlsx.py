#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
直接检查xlsx文件中R列的图片位置
"""
import sys
sys.path.insert(0, '/Users/changun/work/jiuhuan')
from analyze_excel_images import analyze_images_in_xlsx

if __name__ == "__main__":
    xlsx_file = "/Users/changun/Documents/新开模具清单.xlsx"
    analyze_images_in_xlsx(xlsx_file, 'R')

