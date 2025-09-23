"""
Configuration management for Ethereal Client
"""

import os
from typing import Optional, Dict, Any
from dataclasses import dataclass
from dotenv import load_dotenv


@dataclass
class EtherealConfig:
    """Configuration class for Ethereal client settings."""

    base_url: str = "https://api.etherealtest.net"
    rpc_url: str = "https://rpc.etherealtest.net"
    address: Optional[str] = None
    private_key: Optional[str] = None

    @classmethod
    def from_env(cls, env_file: Optional[str] = None) -> 'EtherealConfig':
        """
        Create configuration from environment variables.

        Args:
            env_file: Path to .env file (optional)

        Returns:
            EtherealConfig instance
        """
        if env_file:
            load_dotenv(env_file)
        else:
            load_dotenv()

        return cls(
            base_url=os.getenv('ETHEREAL_BASE_URL', cls.base_url),
            rpc_url=os.getenv('ETHEREAL_RPC_URL', cls.rpc_url),
            address=os.getenv('ETHEREAL_ADDRESS'),
            private_key=os.getenv('ETHEREAL_PRIVATE_KEY')
        )

    @classmethod
    def from_dict(cls, config_dict: Dict[str, Any]) -> 'EtherealConfig':
        """
        Create configuration from dictionary.

        Args:
            config_dict: Configuration dictionary

        Returns:
            EtherealConfig instance
        """
        return cls(
            base_url=config_dict.get('base_url', cls.base_url),
            rpc_url=config_dict.get('rpc_url', cls.rpc_url),
            address=config_dict.get('address'),
            private_key=config_dict.get('private_key')
        )

    def to_ethereal_config(self) -> Dict[str, Any]:
        """
        Convert to format expected by Ethereal SDK.

        Returns:
            Configuration dictionary for Ethereal RESTClient
        """
        config = {
            "base_url": self.base_url,
            "chain_config": {
                "rpc_url": self.rpc_url,
            }
        }

        if self.address:
            config["chain_config"]["address"] = self.address

        if self.private_key:
            config["chain_config"]["private_key"] = self.private_key

        return config

    @property
    def can_trade(self) -> bool:
        """Check if configuration allows trading (has private key)."""
        return self.private_key is not None

    @property
    def can_read_account(self) -> bool:
        """Check if configuration allows reading account data (has address)."""
        return self.address is not None