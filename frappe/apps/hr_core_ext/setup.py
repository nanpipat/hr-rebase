from setuptools import setup, find_packages

setup(
    name="hr_core_ext",
    version="0.1.0",
    description="HR Platform Core Extension for Frappe HR",
    author="HR Platform",
    packages=find_packages(),
    zip_safe=False,
    include_package_data=True,
    install_requires=[],
)
